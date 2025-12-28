import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Group ID is required',
    })
  }

  // Fetch existing group
  const existingGroup = await db.query.taskGroups.findFirst({
    where: and(
      eq(schema.taskGroups.id, id),
      eq(schema.taskGroups.organisationId, session.user.organisationId),
    ),
    with: {
      children: true,
      templates: true,
    },
  })

  if (!existingGroup) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task group not found',
    })
  }

  // Check if group has children - we'll cascade delete via DB constraint
  // but we want to warn the user
  if (existingGroup.children && existingGroup.children.length > 0) {
    // This is just informational - the DB cascade will handle it
    console.log(`Deleting group ${id} with ${existingGroup.children.length} child groups`)
  }

  // Templates will have their groupId set to NULL via onDelete: 'set null'
  if (existingGroup.templates && existingGroup.templates.length > 0) {
    console.log(`Removing group association from ${existingGroup.templates.length} templates`)
  }

  await db
    .delete(schema.taskGroups)
    .where(
      and(
        eq(schema.taskGroups.id, id),
        eq(schema.taskGroups.organisationId, session.user.organisationId),
      ),
    )

  // Log the deletion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'task_group',
    entityId: id,
    oldValues: existingGroup,
  })

  return { success: true }
})
