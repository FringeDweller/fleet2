import { and, eq, gte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/admin/alerts/summary
 *
 * Get a summary of alerts for today.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  // Start of today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Get geofence alerts count by type for today
  const geofenceAlerts = await db
    .select({
      alertType: schema.geofenceAlerts.alertType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.geofenceAlerts)
    .where(
      and(
        eq(schema.geofenceAlerts.organisationId, user.organisationId),
        gte(schema.geofenceAlerts.alertedAt, todayStart),
      ),
    )
    .groupBy(schema.geofenceAlerts.alertType)

  // Get unacknowledged geofence alerts
  const unacknowledgedGeofence = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.geofenceAlerts)
    .where(
      and(
        eq(schema.geofenceAlerts.organisationId, user.organisationId),
        eq(schema.geofenceAlerts.isAcknowledged, false),
      ),
    )

  // Get notifications created today by type
  const notifications = await db
    .select({
      type: schema.notifications.type,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.organisationId, user.organisationId),
        gte(schema.notifications.createdAt, todayStart),
      ),
    )
    .groupBy(schema.notifications.type)

  // Aggregate counts by type
  const byType: Record<string, number> = {}

  // Add geofence alerts
  for (const alert of geofenceAlerts) {
    byType[alert.alertType] = alert.count
  }

  // Add notification types
  for (const notification of notifications) {
    byType[notification.type] = (byType[notification.type] ?? 0) + notification.count
  }

  // Calculate totals
  const totalToday = Object.values(byType).reduce((sum, count) => sum + count, 0)
  const unacknowledged = unacknowledgedGeofence[0]?.count ?? 0

  return {
    totalToday,
    unacknowledged,
    byType,
    generatedAt: new Date().toISOString(),
  }
})
