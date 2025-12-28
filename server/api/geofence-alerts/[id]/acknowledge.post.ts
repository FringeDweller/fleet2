import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const alertId = getRouterParam(event, 'id')

  if (!alertId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Alert ID is required',
    })
  }

  // Find the alert
  const existingAlert = await db.query.geofenceAlerts.findFirst({
    where: and(
      eq(schema.geofenceAlerts.id, alertId),
      eq(schema.geofenceAlerts.organisationId, session.user.organisationId),
    ),
  })

  if (!existingAlert) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alert not found',
    })
  }

  if (existingAlert.isAcknowledged) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Alert has already been acknowledged',
    })
  }

  const now = new Date()

  // Acknowledge the alert
  const [updatedAlert] = await db
    .update(schema.geofenceAlerts)
    .set({
      isAcknowledged: true,
      acknowledgedAt: now,
      acknowledgedById: session.user.id,
    })
    .where(eq(schema.geofenceAlerts.id, alertId))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'acknowledge',
    entityType: 'geofence_alert',
    entityId: alertId,
    oldValues: { isAcknowledged: false },
    newValues: { isAcknowledged: true, acknowledgedAt: now },
  })

  return updatedAlert
})
