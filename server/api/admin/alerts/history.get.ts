import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const querySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  acknowledged: z.enum(['all', 'true', 'false']).default('all'),
})

/**
 * GET /api/admin/alerts/history
 *
 * Get alert history with filtering and pagination.
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
  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { page, limit, type, startDate, endDate, acknowledged } = result.data
  const offset = (page - 1) * limit

  // Build date filters
  const dateFilters = []
  if (startDate) {
    dateFilters.push(gte(schema.geofenceAlerts.alertedAt, new Date(startDate)))
  }
  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    dateFilters.push(lte(schema.geofenceAlerts.alertedAt, end))
  }

  // Build type filter
  const typeFilter = type
    ? or(
        eq(schema.geofenceAlerts.alertType, type as 'entry' | 'exit' | 'after_hours_movement'),
        sql`false`,
      )
    : undefined

  // Build acknowledged filter
  const acknowledgedFilter =
    acknowledged === 'all'
      ? undefined
      : eq(schema.geofenceAlerts.isAcknowledged, acknowledged === 'true')

  // Get geofence alerts
  const geofenceAlerts = await db.query.geofenceAlerts.findMany({
    where: and(
      eq(schema.geofenceAlerts.organisationId, user.organisationId),
      ...dateFilters,
      typeFilter,
      acknowledgedFilter,
    ),
    with: {
      geofence: {
        columns: { id: true, name: true },
      },
      asset: {
        columns: { id: true, assetNumber: true, make: true, model: true },
      },
      acknowledgedBy: {
        columns: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [desc(schema.geofenceAlerts.alertedAt)],
    limit,
    offset,
  })

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.geofenceAlerts)
    .where(
      and(
        eq(schema.geofenceAlerts.organisationId, user.organisationId),
        ...dateFilters,
        typeFilter,
        acknowledgedFilter,
      ),
    )

  const totalCount = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(totalCount / limit)

  // Transform alerts for response
  const alerts = geofenceAlerts.map((alert) => ({
    id: alert.id,
    type: 'geofence',
    subType: alert.alertType,
    title: getAlertTitle(alert.alertType),
    description: `${alert.asset?.assetNumber ?? 'Unknown Asset'} - ${alert.geofence?.name ?? 'Unknown Geofence'}`,
    asset: alert.asset
      ? {
          id: alert.asset.id,
          assetNumber: alert.asset.assetNumber,
          name: alert.asset.make
            ? `${alert.asset.make}${alert.asset.model ? ` ${alert.asset.model}` : ''}`
            : null,
        }
      : null,
    geofence: alert.geofence
      ? {
          id: alert.geofence.id,
          name: alert.geofence.name,
        }
      : null,
    location: {
      latitude: alert.latitude,
      longitude: alert.longitude,
    },
    alertedAt: alert.alertedAt,
    isAcknowledged: alert.isAcknowledged,
    acknowledgedAt: alert.acknowledgedAt,
    acknowledgedBy: alert.acknowledgedBy
      ? {
          id: alert.acknowledgedBy.id,
          name: `${alert.acknowledgedBy.firstName} ${alert.acknowledgedBy.lastName}`.trim(),
        }
      : null,
  }))

  return {
    alerts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  }
})

function getAlertTitle(alertType: string): string {
  switch (alertType) {
    case 'entry':
      return 'Geofence Entry'
    case 'exit':
      return 'Geofence Exit'
    case 'after_hours_movement':
      return 'After-Hours Movement'
    default:
      return 'Alert'
  }
}
