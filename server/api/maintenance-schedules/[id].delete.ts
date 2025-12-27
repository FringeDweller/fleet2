import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async event => {
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
      statusMessage: 'Schedule ID is required'
    })
  }

  // Check if schedule exists and belongs to user's organisation
  const existing = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(schema.maintenanceSchedules.id, id),
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Maintenance schedule not found'
    })
  }

  // Archive the schedule instead of deleting
  const [archived] = await db
    .update(schema.maintenanceSchedules)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      isActive: false, // Also deactivate when archiving
      updatedAt: new Date()
    })
    .where(
      and(
        eq(schema.maintenanceSchedules.id, id),
        eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
      )
    )
    .returning()

  // Log the deletion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'maintenance_schedule',
    entityId: id,
    oldValues: existing
  })

  return { success: true, archived }
})
