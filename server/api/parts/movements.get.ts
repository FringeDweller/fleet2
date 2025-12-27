import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
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

  // Filters
  const search = query.search as string | undefined
  const partId = query.partId as string | undefined
  const usageType = query.usageType as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const userId = query.userId as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // First get all parts for this organisation to filter movements
  const orgParts = await db
    .select({ id: schema.parts.id })
    .from(schema.parts)
    .where(eq(schema.parts.organisationId, session.user.organisationId))

  const partIds = orgParts.map((p) => p.id)

  if (partIds.length === 0) {
    return {
      data: [],
      pagination: {
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
    }
  }

  // Build conditions
  const conditions = [inArray(schema.partUsageHistory.partId, partIds)]

  if (partId) {
    conditions.push(eq(schema.partUsageHistory.partId, partId))
  }

  if (usageType) {
    const validTypes = ['work_order', 'adjustment', 'restock', 'return', 'damaged', 'expired']
    if (validTypes.includes(usageType)) {
      conditions.push(
        eq(
          schema.partUsageHistory.usageType,
          usageType as (typeof schema.partUsageHistory.usageType.enumValues)[number],
        ),
      )
    }
  }

  if (dateFrom) {
    const fromDate = new Date(dateFrom)
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(schema.partUsageHistory.createdAt, fromDate))
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo)
    if (!Number.isNaN(toDate.getTime())) {
      // Set to end of day
      toDate.setHours(23, 59, 59, 999)
      conditions.push(lte(schema.partUsageHistory.createdAt, toDate))
    }
  }

  if (userId) {
    conditions.push(eq(schema.partUsageHistory.userId, userId))
  }

  // Search in notes or reference
  if (search) {
    conditions.push(
      or(
        ilike(schema.partUsageHistory.notes, `%${search}%`),
        ilike(schema.partUsageHistory.reference, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.partUsageHistory)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Get movements with related data
  const movements = await db.query.partUsageHistory.findMany({
    where: whereClause,
    orderBy: desc(schema.partUsageHistory.createdAt),
    limit,
    offset,
    with: {
      part: {
        columns: {
          id: true,
          sku: true,
          name: true,
          unit: true,
        },
      },
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      workOrder: {
        columns: {
          id: true,
          workOrderNumber: true,
          title: true,
        },
      },
    },
  })

  return {
    data: movements,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + movements.length < total,
    },
  }
})
