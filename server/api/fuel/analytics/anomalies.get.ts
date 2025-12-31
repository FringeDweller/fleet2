/**
 * GET /api/fuel/analytics/anomalies
 *
 * Detects and returns fuel consumption anomalies:
 * - Unusually high consumption (potential issues)
 * - Unusually low consumption (possible recording errors)
 * - Missing odometer data
 */

import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import {
  calculateConsumption,
  detectAnomalies,
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
  const severity = query.severity as 'warning' | 'critical' | undefined
  const warningThreshold = parseInt(query.warningThreshold as string, 10) || 30
  const criticalThreshold = parseInt(query.criticalThreshold as string, 10) || 50

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

  // Build asset info map
  const assetInfo = new Map<
    string,
    { assetNumber: string; make: string | null; model: string | null }
  >()

  for (const t of transactions) {
    if (!assetInfo.has(t.assetId)) {
      assetInfo.set(t.assetId, {
        assetNumber: t.assetNumber || '',
        make: t.make,
        model: t.model,
      })
    }
  }

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

  // Detect anomalies
  let anomalies = detectAnomalies(
    consumptionResults,
    assetInfo,
    warningThreshold,
    criticalThreshold,
  )

  // Filter by severity if specified
  if (severity) {
    anomalies = anomalies.filter((a) => a.severity === severity)
  }

  // Find transactions missing odometer data
  const missingOdometerConditions = [
    eq(schema.fuelTransactions.organisationId, session.user.organisationId),
    isNull(schema.fuelTransactions.odometer),
    gte(schema.fuelTransactions.transactionDate, dateFrom ? new Date(dateFrom) : defaultDateFrom),
  ]

  if (dateTo) {
    missingOdometerConditions.push(lte(schema.fuelTransactions.transactionDate, new Date(dateTo)))
  }

  if (assetId) {
    missingOdometerConditions.push(eq(schema.fuelTransactions.assetId, assetId))
  }

  const missingOdometerCount = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.fuelTransactions)
    .where(and(...missingOdometerConditions))

  const recentMissingOdometer = await db
    .select({
      id: schema.fuelTransactions.id,
      assetId: schema.fuelTransactions.assetId,
      transactionDate: schema.fuelTransactions.transactionDate,
      quantity: schema.fuelTransactions.quantity,
      totalCost: schema.fuelTransactions.totalCost,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
    })
    .from(schema.fuelTransactions)
    .leftJoin(schema.assets, eq(schema.fuelTransactions.assetId, schema.assets.id))
    .where(and(...missingOdometerConditions))
    .orderBy(sql`${schema.fuelTransactions.transactionDate} DESC`)
    .limit(20)

  // Summary by anomaly type
  const highConsumptionCount = anomalies.filter((a) => a.anomalyType === 'high_consumption').length
  const lowConsumptionCount = anomalies.filter((a) => a.anomalyType === 'low_consumption').length
  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length

  // Group anomalies by asset
  const anomaliesByAsset = new Map<string, number>()
  for (const anomaly of anomalies) {
    const count = anomaliesByAsset.get(anomaly.assetId) || 0
    anomaliesByAsset.set(anomaly.assetId, count + 1)
  }

  // Find assets with most anomalies
  const assetsWithMostAnomalies = Array.from(anomaliesByAsset.entries())
    .map(([assetId, count]) => ({
      assetId,
      assetNumber: assetInfo.get(assetId)?.assetNumber || '',
      make: assetInfo.get(assetId)?.make || null,
      model: assetInfo.get(assetId)?.model || null,
      anomalyCount: count,
    }))
    .sort((a, b) => b.anomalyCount - a.anomalyCount)
    .slice(0, 10)

  return {
    anomalies: anomalies.slice(0, 50), // Limit for performance
    missingOdometer: {
      count: missingOdometerCount[0]?.count ?? 0,
      recent: recentMissingOdometer.map((t) => ({
        transactionId: t.id,
        assetId: t.assetId,
        assetNumber: t.assetNumber,
        make: t.make,
        model: t.model,
        transactionDate: t.transactionDate,
        quantity: parseFloat(t.quantity),
        totalCost: t.totalCost ? parseFloat(t.totalCost) : null,
        anomalyType: 'no_odometer' as const,
        severity: 'warning' as const,
      })),
    },
    summary: {
      totalAnomalies: anomalies.length,
      highConsumptionCount,
      lowConsumptionCount,
      criticalCount,
      warningCount,
      missingOdometerCount: missingOdometerCount[0]?.count ?? 0,
    },
    assetsWithMostAnomalies,
    thresholds: {
      warningPercent: warningThreshold,
      criticalPercent: criticalThreshold,
    },
  }
})
