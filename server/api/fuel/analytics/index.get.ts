/**
 * GET /api/fuel/analytics
 *
 * Returns fuel consumption analytics with date range filtering:
 * - Overall consumption stats (L/100km, cost/km)
 * - Per-asset consumption breakdown
 * - Fleet-wide averages
 */

import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import {
  calculateAssetAverages,
  calculateConsumption,
  type FuelConsumptionRecord,
} from '../../../utils/fuel-analytics'

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

  // Fetch transactions with asset info
  const transactions = await db
    .select({
      id: schema.fuelTransactions.id,
      assetId: schema.fuelTransactions.assetId,
      transactionDate: schema.fuelTransactions.transactionDate,
      quantity: schema.fuelTransactions.quantity,
      totalCost: schema.fuelTransactions.totalCost,
      odometer: schema.fuelTransactions.odometer,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
    })
    .from(schema.fuelTransactions)
    .leftJoin(schema.assets, eq(schema.fuelTransactions.assetId, schema.assets.id))
    .where(whereClause)
    .orderBy(schema.fuelTransactions.transactionDate)

  // Convert to consumption records
  const consumptionRecords: FuelConsumptionRecord[] = transactions.map((t) => ({
    transactionId: t.id,
    assetId: t.assetId,
    transactionDate: t.transactionDate,
    quantity: parseFloat(t.quantity),
    totalCost: t.totalCost ? parseFloat(t.totalCost) : null,
    odometer: t.odometer ? parseFloat(t.odometer) : null,
  }))

  // Calculate consumption metrics
  const consumptionResults = calculateConsumption(consumptionRecords)
  const assetAverages = calculateAssetAverages(consumptionResults)

  // Calculate fleet-wide averages
  let fleetAvgL100 = 0
  let fleetAvgCostPerKm = 0
  let countL100 = 0
  let countCost = 0

  for (const result of consumptionResults) {
    fleetAvgL100 += result.litersPerHundredKm
    countL100 += 1

    if (result.costPerKm !== null) {
      fleetAvgCostPerKm += result.costPerKm
      countCost += 1
    }
  }

  // Build asset summary with consumption data
  const assetMap = new Map<
    string,
    {
      assetNumber: string
      make: string | null
      model: string | null
      totalLitres: number
      totalCost: number
      transactionCount: number
    }
  >()

  for (const t of transactions) {
    if (!assetMap.has(t.assetId)) {
      assetMap.set(t.assetId, {
        assetNumber: t.assetNumber || '',
        make: t.make,
        model: t.model,
        totalLitres: 0,
        totalCost: 0,
        transactionCount: 0,
      })
    }

    const asset = assetMap.get(t.assetId)!
    asset.totalLitres += parseFloat(t.quantity)
    asset.totalCost += t.totalCost ? parseFloat(t.totalCost) : 0
    asset.transactionCount += 1
  }

  // Build per-asset analytics
  const perAssetAnalytics = Array.from(assetMap.entries()).map(([assetId, info]) => {
    const avgData = assetAverages.get(assetId)

    return {
      assetId,
      assetNumber: info.assetNumber,
      make: info.make,
      model: info.model,
      totalLitres: info.totalLitres,
      totalCost: info.totalCost,
      transactionCount: info.transactionCount,
      avgLitersPer100Km: avgData?.avgLitersPer100Km ?? null,
      avgCostPerKm: avgData?.avgCostPerKm ?? null,
      consumptionDataPoints: avgData?.count ?? 0,
    }
  })

  // Sort by total litres consumed (highest first)
  perAssetAnalytics.sort((a, b) => b.totalLitres - a.totalLitres)

  // Overall totals
  const overallResult = await db
    .select({
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(whereClause)

  // Count transactions with odometer (needed for consumption calc)
  const odometerCountResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(and(whereClause, sql`${schema.fuelTransactions.odometer} IS NOT NULL`))

  return {
    overall: {
      totalLitres: overallResult[0]?.totalQuantity ?? 0,
      totalCost: overallResult[0]?.totalCost ?? 0,
      avgUnitCost: overallResult[0]?.avgUnitCost ?? 0,
      transactionCount: overallResult[0]?.transactionCount ?? 0,
      transactionsWithOdometer: odometerCountResult[0]?.count ?? 0,
    },
    fleetAverages: {
      avgLitersPer100Km: countL100 > 0 ? fleetAvgL100 / countL100 : null,
      avgCostPerKm: countCost > 0 ? fleetAvgCostPerKm / countCost : null,
      dataPoints: countL100,
    },
    perAsset: perAssetAnalytics,
    consumptionRecords: consumptionResults.slice(0, 100), // Limit for performance
  }
})
