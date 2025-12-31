/**
 * GET /api/fuel/analytics/trends
 *
 * Returns consumption trends over time:
 * - Daily/weekly/monthly consumption averages
 * - Cost trends
 * - Volume trends
 */

import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import {
  calculateConsumption,
  type FuelConsumptionRecord,
  groupConsumptionByPeriod,
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
  const period = (query.period as 'daily' | 'weekly' | 'monthly') || 'monthly'

  // Default to last 12 months if no date range specified
  const defaultDateFrom = new Date()
  defaultDateFrom.setMonth(defaultDateFrom.getMonth() - 12)

  const conditions = [
    eq(schema.fuelTransactions.organisationId, session.user.organisationId),
    gte(schema.fuelTransactions.transactionDate, dateFrom ? new Date(dateFrom) : defaultDateFrom),
  ]

  if (dateTo) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  if (assetId) {
    conditions.push(eq(schema.fuelTransactions.assetId, assetId))
  }

  const whereClause = and(...conditions)

  // Fetch transactions
  const transactions = await db
    .select({
      id: schema.fuelTransactions.id,
      assetId: schema.fuelTransactions.assetId,
      transactionDate: schema.fuelTransactions.transactionDate,
      quantity: schema.fuelTransactions.quantity,
      totalCost: schema.fuelTransactions.totalCost,
      odometer: schema.fuelTransactions.odometer,
    })
    .from(schema.fuelTransactions)
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

  // Group by period
  const groupedData = groupConsumptionByPeriod(consumptionResults, period)

  // Convert to sorted array
  const trends = Array.from(groupedData.values()).sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  )

  // Also get raw volume/cost trends (not requiring odometer)
  let dateFormat: string
  switch (period) {
    case 'daily':
      dateFormat = 'YYYY-MM-DD'
      break
    case 'weekly':
      dateFormat = 'IYYY-"W"IW'
      break
    default:
      dateFormat = 'YYYY-MM'
      break
  }

  const volumeTrends = await db
    .select({
      period: sql<string>`to_char(transaction_date, ${dateFormat})`,
      totalQuantity: sql<number>`COALESCE(SUM(quantity::numeric), 0)`,
      totalCost: sql<number>`COALESCE(SUM(total_cost::numeric), 0)`,
      avgUnitCost: sql<number>`COALESCE(AVG(unit_cost::numeric), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(whereClause)
    .groupBy(sql`to_char(transaction_date, ${dateFormat})`)
    .orderBy(sql`to_char(transaction_date, ${dateFormat})`)

  // Calculate trend direction (comparing recent to earlier periods)
  const recentPeriods = trends.slice(-3)
  const earlierPeriods = trends.slice(-6, -3)

  let consumptionTrend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' =
    'insufficient_data'
  let costTrend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' = 'insufficient_data'

  if (recentPeriods.length >= 2 && earlierPeriods.length >= 2) {
    const recentAvgL100 =
      recentPeriods.reduce((sum, p) => sum + p.avgLitersPer100Km, 0) / recentPeriods.length
    const earlierAvgL100 =
      earlierPeriods.reduce((sum, p) => sum + p.avgLitersPer100Km, 0) / earlierPeriods.length

    const consumptionChange = ((recentAvgL100 - earlierAvgL100) / earlierAvgL100) * 100

    if (consumptionChange > 5) {
      consumptionTrend = 'increasing'
    } else if (consumptionChange < -5) {
      consumptionTrend = 'decreasing'
    } else {
      consumptionTrend = 'stable'
    }

    // Cost trend from volume trends
    const recentVolume = volumeTrends.slice(-3)
    const earlierVolume = volumeTrends.slice(-6, -3)

    if (recentVolume.length >= 2 && earlierVolume.length >= 2) {
      const recentAvgCost =
        recentVolume.reduce((sum, p) => sum + (p.avgUnitCost || 0), 0) / recentVolume.length
      const earlierAvgCost =
        earlierVolume.reduce((sum, p) => sum + (p.avgUnitCost || 0), 0) / earlierVolume.length

      const costChange =
        earlierAvgCost > 0 ? ((recentAvgCost - earlierAvgCost) / earlierAvgCost) * 100 : 0

      if (costChange > 5) {
        costTrend = 'increasing'
      } else if (costChange < -5) {
        costTrend = 'decreasing'
      } else {
        costTrend = 'stable'
      }
    }
  }

  return {
    period,
    consumptionTrends: trends,
    volumeTrends: volumeTrends.map((v) => ({
      period: v.period,
      totalLitres: v.totalQuantity,
      totalCost: v.totalCost,
      avgUnitCost: v.avgUnitCost,
      transactionCount: v.transactionCount,
    })),
    trendIndicators: {
      consumption: consumptionTrend,
      cost: costTrend,
    },
  }
})
