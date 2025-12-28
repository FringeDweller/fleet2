import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Filters
  const geofenceId = query.geofenceId as string | undefined
  const assetId = query.assetId as string | undefined
  const alertType = query.alertType as string | undefined
  const isAcknowledged = query.isAcknowledged as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined

  // Sorting
  const sortOrder = (query.sortOrder as string) || 'desc'

  const conditions = [eq(schema.geofenceAlerts.organisationId, session.user.organisationId)]

  if (geofenceId) {
    conditions.push(eq(schema.geofenceAlerts.geofenceId, geofenceId))
  }

  if (assetId) {
    conditions.push(eq(schema.geofenceAlerts.assetId, assetId))
  }

  if (alertType && ['entry', 'exit', 'after_hours_movement'].includes(alertType)) {
    conditions.push(
      eq(schema.geofenceAlerts.alertType, alertType as 'entry' | 'exit' | 'after_hours_movement'),
    )
  }

  if (isAcknowledged !== undefined) {
    conditions.push(eq(schema.geofenceAlerts.isAcknowledged, isAcknowledged === 'true'))
  }

  if (startDate) {
    const startDateTime = new Date(startDate)
    if (!Number.isNaN(startDateTime.getTime())) {
      conditions.push(gte(schema.geofenceAlerts.alertedAt, startDateTime))
    }
  }

  if (endDate) {
    const endDateTime = new Date(endDate)
    if (!Number.isNaN(endDateTime.getTime())) {
      conditions.push(lte(schema.geofenceAlerts.alertedAt, endDateTime))
    }
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
      geofence: {
        columns: {
          id: true,
          name: true,
          category: true,
          color: true,
        },
      },
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
