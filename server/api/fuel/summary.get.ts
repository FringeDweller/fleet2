import { and, eq, gte, lte, sql } from 'drizzle-orm'
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

  // Date range filters
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const assetId = query.assetId as string | undefined

  const conditions = [eq(schema.fuelTransactions.organisationId, session.user.organisationId)]

  if (dateFrom) {
    conditions.push(gte(schema.fuelTransactions.transactionDate, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  if (assetId) {
    conditions.push(eq(schema.fuelTransactions.assetId, assetId))
  }

  const whereClause = and(...conditions)

  // Overall summary
  const overallResult = await db
    .select({
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(whereClause)

  // Summary by fuel type
  const byFuelTypeResult = await db
    .select({
      fuelType: schema.fuelTransactions.fuelType,
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(whereClause)
    .groupBy(schema.fuelTransactions.fuelType)

  // Summary by asset (top 10 consumers)
  const byAssetResult = await db
    .select({
      assetId: schema.fuelTransactions.assetId,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
      totalQuantity: sql<number>`COALESCE(SUM(${schema.fuelTransactions.quantity}::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${schema.fuelTransactions.totalCost}::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .leftJoin(schema.assets, eq(schema.fuelTransactions.assetId, schema.assets.id))
    .where(whereClause)
    .groupBy(
      schema.fuelTransactions.assetId,
      schema.assets.assetNumber,
      schema.assets.make,
      schema.assets.model,
    )
    .orderBy(sql`SUM(${schema.fuelTransactions.quantity}::numeric) DESC`)
    .limit(10)

  // Monthly trend (last 12 months)
  const monthlyTrendResult = await db
    .select({
      month: sql<string>`to_char(transaction_date, 'YYYY-MM')`,
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(
      and(
        eq(schema.fuelTransactions.organisationId, session.user.organisationId),
        gte(schema.fuelTransactions.transactionDate, sql`NOW() - INTERVAL '12 months'`),
      ),
    )
    .groupBy(sql`to_char(transaction_date, 'YYYY-MM')`)
    .orderBy(sql`to_char(transaction_date, 'YYYY-MM')`)

  // Recent transactions
  const recentTransactions = await db.query.fuelTransactions.findMany({
    where: eq(schema.fuelTransactions.organisationId, session.user.organisationId),
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
    },
    orderBy: (fuelTransactions, { desc }) => [desc(fuelTransactions.transactionDate)],
    limit: 5,
  })

  return {
    overall: overallResult[0] || {
      totalQuantity: 0,
      totalCost: 0,
      avgUnitCost: 0,
      transactionCount: 0,
    },
    byFuelType: byFuelTypeResult,
    byAsset: byAssetResult,
    monthlyTrend: monthlyTrendResult,
    recentTransactions,
  }
})
