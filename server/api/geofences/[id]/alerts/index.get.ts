import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const geofenceId = getRouterParam(event, 'id')

  if (!geofenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Geofence ID is required',
    })
  }

  const query = getQuery(event)

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Filters
  const alertType = query.alertType as string | undefined
  const isAcknowledged = query.isAcknowledged as string | undefined

  // Sorting
  const sortOrder = (query.sortOrder as string) || 'desc'

  // Verify geofence exists and belongs to the organisation
  const geofence = await db.query.geofences.findFirst({
    where: and(
      eq(schema.geofences.id, geofenceId),
      eq(schema.geofences.organisationId, session.user.organisationId),
    ),
  })

  if (!geofence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Geofence not found',
    })
  }

  const conditions = [
    eq(schema.geofenceAlerts.geofenceId, geofenceId),
    eq(schema.geofenceAlerts.organisationId, session.user.organisationId),
  ]

  if (alertType && ['entry', 'exit', 'after_hours_movement'].includes(alertType)) {
    conditions.push(
      eq(schema.geofenceAlerts.alertType, alertType as 'entry' | 'exit' | 'after_hours_movement'),
    )
  }

  if (isAcknowledged !== undefined) {
    conditions.push(eq(schema.geofenceAlerts.isAcknowledged, isAcknowledged === 'true'))
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.geofenceAlerts)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Get alerts
  const sortFn = sortOrder === 'asc' ? asc : desc

  const alerts = await db.query.geofenceAlerts.findMany({
    where: whereClause,
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      operatorSession: {
        with: {
          operator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      acknowledgedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (alerts) => [sortFn(alerts.alertedAt)],
    limit,
    offset,
  })

  return {
    data: alerts,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + alerts.length < total,
    },
  }
})
