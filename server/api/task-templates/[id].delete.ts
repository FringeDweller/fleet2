import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required'
    })
  }

  // Get existing template for audit log
  const existing = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, id),
      eq(schema.taskTemplates.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found'
    })
  }

  // Soft delete (archive)
  await db
    .update(schema.taskTemplates)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(schema.taskTemplates.id, id),
        eq(schema.taskTemplates.organisationId, session.user.organisationId)
      )
    )

  // Log the archive in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'archive',
    entityType: 'task_template',
    entityId: id,
    oldValues: existing
  })

  return { success: true, message: 'Template archived successfully' }
})
