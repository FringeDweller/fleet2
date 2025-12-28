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
      statusMessage: 'Assignment ID is required',
    })
  }

  // Fetch existing assignment
  const existingAssignment = await db.query.customFormAssignments.findFirst({
    where: and(
      eq(schema.customFormAssignments.id, id),
      eq(schema.customFormAssignments.organisationId, session.user.organisationId),
    ),
    with: {
      form: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!existingAssignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form assignment not found',
    })
  }

  await db
    .delete(schema.customFormAssignments)
    .where(
      and(
        eq(schema.customFormAssignments.id, id),
        eq(schema.customFormAssignments.organisationId, session.user.organisationId),
      ),
    )

  // Log the deletion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'custom_form_assignment',
    entityId: id,
    oldValues: existingAssignment,
  })

  return { success: true }
})
