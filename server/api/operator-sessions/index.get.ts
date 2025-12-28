import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission to view operator sessions
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filters
  const assetId = query.assetId as string | undefined
  const operatorId = query.operatorId as string | undefined
  const status = query.status as 'active' | 'completed' | 'cancelled' | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'startTime'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = [
    'startTime',
    'endTime',
    'tripDistance',
    'tripDurationMinutes',
    'createdAt',
  ]

  const conditions = [eq(schema.operatorSessions.organisationId, user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.operatorSessions.assetId, assetId))
  }

  if (operatorId) {
    conditions.push(eq(schema.operatorSessions.operatorId, operatorId))
  }

  if (status && ['active', 'completed', 'cancelled'].includes(status)) {
    conditions.push(eq(schema.operatorSessions.status, status))
  }

  if (dateFrom) {
    conditions.push(gte(schema.operatorSessions.startTime, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.operatorSessions.startTime, new Date(dateTo)))
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.operatorSessions)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort field
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'startTime'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const sessions = await db.query.operatorSessions.findMany({
    where: whereClause,
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          imageUrl: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: (sessions) => [sortFn(sessions[sortField as keyof typeof sessions])],
    limit,
    offset,
  })

  return {
    data: sessions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + sessions.length < total,
    },
  }
})
