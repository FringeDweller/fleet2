/**
 * GET /api/fuel/analytics/comparison
 *
 * Returns fleet comparison data:
 * - Compare vehicles by consumption efficiency
 * - Rank vehicles by L/100km and cost/km
 * - Identify best and worst performers
 */

import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { calculateConsumption, type FuelConsumptionRecord } from '../../../utils/fuel-analytics'

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
  const categoryId = query.categoryId as string | undefined

  // Default to last 6 months if no date range specified
  const defaultDateFrom = new Date()
  defaultDateFrom.setMonth(defaultDateFrom.getMonth() - 6)

  const conditions = [
    eq(schema.fuelTransactions.organisationId, session.user.organisationId),
    gte(schema.fuelTransactions.transactionDate, dateFrom ? new Date(dateFrom) : defaultDateFrom),
  ]

  if (dateTo) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  // Fetch transactions with asset info
  const transactionsQuery = db
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
      year: schema.assets.year,
      categoryId: schema.assets.categoryId,
    })
    .from(schema.fuelTransactions)
    .leftJoin(schema.assets, eq(schema.fuelTransactions.assetId, schema.assets.id))
    .where(and(...conditions))
    .orderBy(schema.fuelTransactions.transactionDate)

  const transactions = await transactionsQuery

  // Filter by category if specified (post-query filter)
  const filteredTransactions = categoryId
    ? transactions.filter((t) => t.categoryId === categoryId)
    : transactions

  // Convert to consumption records
  const consumptionRecords: FuelConsumptionRecord[] = filteredTransactions.map((t) => ({
    transactionId: t.id,
    assetId: t.assetId,
    transactionDate: t.transactionDate,
    quantity: parseFloat(t.quantity),
    totalCost: t.totalCost ? parseFloat(t.totalCost) : null,
    odometer: t.odometer ? parseFloat(t.odometer) : null,
  }))

  // Calculate consumption metrics
  const consumptionResults = calculateConsumption(consumptionRecords)

  // Aggregate by asset
  const assetStats = new Map<
    string,
    {
      assetId: string
      assetNumber: string
      make: string | null
      model: string | null
      year: number | null
      totalLitres: number
      totalCost: number
      totalDistanceKm: number
      sumL100: number
      sumCostPerKm: number
      countL100: number
      countCost: number
      transactionCount: number
    }
  >()

  // Initialize from all transactions (for volume/cost totals)
  for (const t of filteredTransactions) {
    if (!assetStats.has(t.assetId)) {
      assetStats.set(t.assetId, {
        assetId: t.assetId,
        assetNumber: t.assetNumber || '',
        make: t.make,
        model: t.model,
        year: t.year,
        totalLitres: 0,
        totalCost: 0,
        totalDistanceKm: 0,
        sumL100: 0,
        sumCostPerKm: 0,
        countL100: 0,
        countCost: 0,
        transactionCount: 0,
      })
    }

    const stats = assetStats.get(t.assetId)!
    stats.totalLitres += parseFloat(t.quantity)
    stats.totalCost += t.totalCost ? parseFloat(t.totalCost) : 0
    stats.transactionCount += 1
  }

  // Add consumption data
  for (const result of consumptionResults) {
    const stats = assetStats.get(result.assetId)
    if (stats) {
      stats.totalDistanceKm += result.distanceKm
      stats.sumL100 += result.litersPerHundredKm
      stats.countL100 += 1

      if (result.costPerKm !== null) {
        stats.sumCostPerKm += result.costPerKm
        stats.countCost += 1
      }
    }
  }

  // Build comparison array
  const comparison = Array.from(assetStats.values())
    .filter((s) => s.countL100 >= 2) // Require at least 2 consumption data points
    .map((s) => ({
      assetId: s.assetId,
      assetNumber: s.assetNumber,
      make: s.make,
      model: s.model,
      year: s.year,
      totalLitres: s.totalLitres,
      totalCost: s.totalCost,
      totalDistanceKm: s.totalDistanceKm,
      avgLitersPer100Km: s.countL100 > 0 ? s.sumL100 / s.countL100 : null,
      avgCostPerKm: s.countCost > 0 ? s.sumCostPerKm / s.countCost : null,
      transactionCount: s.transactionCount,
      consumptionDataPoints: s.countL100,
    }))

  // Calculate fleet average for comparison
  const fleetTotalL100 = comparison.reduce((sum, a) => sum + (a.avgLitersPer100Km || 0), 0)
  const fleetTotalCostPerKm = comparison.reduce((sum, a) => sum + (a.avgCostPerKm || 0), 0)
  const fleetAvgL100 = comparison.length > 0 ? fleetTotalL100 / comparison.length : 0
  const fleetAvgCostPerKm = comparison.length > 0 ? fleetTotalCostPerKm / comparison.length : 0

  // Add comparison to fleet average
  const comparisonWithRanking = comparison.map((asset) => {
    const l100Deviation = asset.avgLitersPer100Km
      ? ((asset.avgLitersPer100Km - fleetAvgL100) / fleetAvgL100) * 100
      : null
    const costDeviation = asset.avgCostPerKm
      ? ((asset.avgCostPerKm - fleetAvgCostPerKm) / fleetAvgCostPerKm) * 100
      : null

    return {
      ...asset,
      vsFleetAvgL100Percent: l100Deviation,
      vsFleetAvgCostPercent: costDeviation,
      efficiencyRating:
        l100Deviation !== null
          ? l100Deviation < -10
            ? 'excellent'
            : l100Deviation < 0
              ? 'good'
              : l100Deviation < 10
                ? 'average'
                : 'poor'
          : 'unknown',
    }
  })

  // Sort by efficiency (lowest L/100km is best)
  const sortedByEfficiency = [...comparisonWithRanking].sort(
    (a, b) => (a.avgLitersPer100Km || 999) - (b.avgLitersPer100Km || 999),
  )

  // Sort by cost efficiency
  const sortedByCost = [...comparisonWithRanking].sort(
    (a, b) => (a.avgCostPerKm || 999) - (b.avgCostPerKm || 999),
  )

  // Add rankings
  const rankedComparison = comparisonWithRanking.map((asset) => ({
    ...asset,
    efficiencyRank: sortedByEfficiency.findIndex((a) => a.assetId === asset.assetId) + 1,
    costRank: sortedByCost.findIndex((a) => a.assetId === asset.assetId) + 1,
  }))

  // Sort final output by efficiency rank
  rankedComparison.sort((a, b) => a.efficiencyRank - b.efficiencyRank)

  // Identify best and worst performers
  const bestPerformers = rankedComparison.slice(0, 5)
  const worstPerformers = rankedComparison
    .filter((a) => a.avgLitersPer100Km !== null)
    .slice(-5)
    .reverse()

  return {
    fleetAverages: {
      avgLitersPer100Km: fleetAvgL100,
      avgCostPerKm: fleetAvgCostPerKm,
      totalVehicles: comparison.length,
    },
    comparison: rankedComparison,
    bestPerformers,
    worstPerformers,
    summary: {
      totalVehiclesAnalyzed: rankedComparison.length,
      vehiclesWithInsufficientData: Array.from(assetStats.values()).filter((s) => s.countL100 < 2)
        .length,
      excellentCount: rankedComparison.filter((a) => a.efficiencyRating === 'excellent').length,
      goodCount: rankedComparison.filter((a) => a.efficiencyRating === 'good').length,
      averageCount: rankedComparison.filter((a) => a.efficiencyRating === 'average').length,
      poorCount: rankedComparison.filter((a) => a.efficiencyRating === 'poor').length,
    },
  }
})
