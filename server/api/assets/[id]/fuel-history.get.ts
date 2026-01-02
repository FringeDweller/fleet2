import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const query = getQuery(event)

  // Filters
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortOrder = (query.sortOrder as string) || 'desc'

  const conditions = [
    eq(schema.fuelTransactions.assetId, assetId),
    eq(schema.fuelTransactions.organisationId, session.user.organisationId),
  ]

  if (dateFrom) {
    conditions.push(gte(schema.fuelTransactions.transactionDate, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.fuelTransactions)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  const sortFn = sortOrder === 'asc' ? asc : desc

  const transactions = await db.query.fuelTransactions.findMany({
    where: whereClause,
    with: {
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
    orderBy: (fuelTransactions) => [sortFn(fuelTransactions.transactionDate)],
    limit,
    offset,
  })

  // Calculate summary statistics
  const summaryResult = await db
    .select({
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(whereClause)

  const rawSummary = summaryResult[0] || {
    totalQuantity: 0,
    totalCost: 0,
    avgUnitCost: 0,
    transactionCount: 0,
  }

  // Ensure numeric values are proper JavaScript numbers (PostgreSQL returns numeric as strings)
  const summary = {
    totalQuantity: Number(rawSummary.totalQuantity) || 0,
    totalCost: Number(rawSummary.totalCost) || 0,
    avgUnitCost: Number(rawSummary.avgUnitCost) || 0,
    transactionCount: Number(rawSummary.transactionCount) || 0,
  }

  // Calculate fuel efficiency if we have odometer data
  let fuelEfficiency = null
  if (transactions.length >= 2) {
    const sortedByOdometer = transactions
      .filter((t) => t.odometer !== null)
      .sort((a, b) => Number(a.odometer) - Number(b.odometer))

    if (sortedByOdometer.length >= 2) {
      const first = sortedByOdometer[0]!
      const last = sortedByOdometer[sortedByOdometer.length - 1]!
      const distance = Number(last.odometer) - Number(first.odometer)
      const totalFuel = sortedByOdometer.reduce((sum, t) => sum + Number(t.quantity), 0)

      if (distance > 0 && totalFuel > 0) {
        // L/100km
        fuelEfficiency = {
          per100km: (totalFuel / distance) * 100,
          kmPerLitre: distance / totalFuel,
          distance,
          totalFuel,
        }
      }
    }
  }

  return {
    data: transactions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + transactions.length < total,
    },
    summary: {
      ...summary,
      fuelEfficiency,
    },
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
    },
  }
})
