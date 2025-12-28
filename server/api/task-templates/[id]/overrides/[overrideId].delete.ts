import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const templateId = getRouterParam(event, 'id')
  const overrideId = getRouterParam(event, 'overrideId')

  if (!templateId || !overrideId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID and Override ID are required',
    })
  }

  // Verify the override exists and belongs to the organization
  const existingOverride = await db.query.taskOverrides.findFirst({
    where: and(
      eq(schema.taskOverrides.id, overrideId),
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
    ),
  })

  if (!existingOverride) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Override not found',
    })
  }

  // Delete the override
  await db.delete(schema.taskOverrides).where(eq(schema.taskOverrides.id, overrideId))

  // Log the deletion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'task_override',
    entityId: overrideId,
    oldValues: existingOverride,
  })

  return { success: true, message: 'Override deleted successfully' }
})
