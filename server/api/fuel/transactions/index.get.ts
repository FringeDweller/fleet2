import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

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
  const assetId = query.assetId as string | undefined
  const userId = query.userId as string | undefined
  const fuelType = query.fuelType as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'transactionDate'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = [
    'transactionDate',
    'quantity',
    'totalCost',
    'odometer',
    'engineHours',
    'createdAt',
  ]

  const conditions = [eq(schema.fuelTransactions.organisationId, session.user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.fuelTransactions.assetId, assetId))
  }

  if (userId) {
    conditions.push(eq(schema.fuelTransactions.userId, userId))
  }

  if (fuelType && ['diesel', 'petrol', 'electric', 'lpg', 'other'].includes(fuelType)) {
    conditions.push(
      eq(
        schema.fuelTransactions.fuelType,
        fuelType as 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other',
      ),
    )
  }

  if (dateFrom) {
    conditions.push(gte(schema.fuelTransactions.transactionDate, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.fuelTransactions.notes, `%${search}%`),
        ilike(schema.fuelTransactions.vendor, `%${search}%`),
        ilike(schema.fuelTransactions.locationName, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.fuelTransactions)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'transactionDate'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const transactions = await db.query.fuelTransactions.findMany({
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
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          status: true,
          startTime: true,
        },
      },
    },
    orderBy: (fuelTransactions) => [
      sortFn(fuelTransactions[sortField as keyof typeof fuelTransactions]),
    ],
    limit,
    offset,
  })

  return {
    data: transactions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + transactions.length < total,
    },
  }
})
