/**
 * POST /api/fuel/check-anomalies
 *
 * Trigger anomaly detection and send notifications for any anomalies found.
 * This can be called manually or scheduled via a cron job.
 */

import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import {
  calculateConsumption,
  detectAnomalies,
  type FuelConsumptionRecord,
} from '../../utils/fuel-analytics'
import { createFuelAnomalyNotification } from '../../utils/notifications'

interface CheckAnomaliesBody {
  // Optional: only check specific assets
  assetIds?: string[]
  // Optional: custom date range (defaults to last 30 days)
  dateFrom?: string
  dateTo?: string
  // Dry run: don't create notifications
  dryRun?: boolean
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const organisationId = session.user.organisationId
  const body = await readBody<CheckAnomaliesBody>(event)
  const dryRun = body.dryRun ?? false

  // Get alert settings for the organisation
  const [settings] = await db
    .select()
    .from(schema.fuelAlertSettings)
    .where(eq(schema.fuelAlertSettings.organisationId, organisationId))
    .limit(1)

  // Use settings or defaults
  const warningThreshold = settings ? parseFloat(settings.highConsumptionThreshold) : 30
  const criticalThreshold = settings ? parseFloat(settings.criticalThreshold) : 50
  const minDistanceBetweenRefuels = settings ? parseFloat(settings.minDistanceBetweenRefuels) : 10
  const enableHighConsumption = settings?.enableHighConsumptionAlerts ?? true
  const enableLowConsumption = settings?.enableLowConsumptionAlerts ?? true
  const enableRefuelWithoutDistance = settings?.enableRefuelWithoutDistanceAlerts ?? true
  const enableMissingOdometer = settings?.enableMissingOdometerAlerts ?? true
  const sendInAppNotifications = settings?.sendInAppNotifications ?? true

  // Default date range: last 30 days
  const defaultDateFrom = new Date()
  defaultDateFrom.setDate(defaultDateFrom.getDate() - 30)
  const dateFrom = body.dateFrom ? new Date(body.dateFrom) : defaultDateFrom
  const dateTo = body.dateTo ? new Date(body.dateTo) : new Date()

  // Build conditions for transaction query
  const conditions = [
    eq(schema.fuelTransactions.organisationId, organisationId),
    gte(schema.fuelTransactions.transactionDate, dateFrom),
  ]

  if (body.assetIds && body.assetIds.length > 0) {
    conditions.push(sql`${schema.fuelTransactions.assetId} = ANY(${body.assetIds})`)
  }

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
    .where(and(...conditions))
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

  // Detect anomalies using configured thresholds
  let anomalies = detectAnomalies(
    consumptionResults,
    assetInfo,
    warningThreshold,
    criticalThreshold,
  )

  // Filter by enabled alert types
  if (!enableHighConsumption) {
    anomalies = anomalies.filter((a) => a.anomalyType !== 'high_consumption')
  }
  if (!enableLowConsumption) {
    anomalies = anomalies.filter((a) => a.anomalyType !== 'low_consumption')
  }

  // Detect refuel without distance anomalies
  const refuelWithoutDistanceAnomalies: Array<{
    transactionId: string
    assetId: string
    assetNumber: string
    transactionDate: Date
    quantity: number
    distanceKm: number
  }> = []

  if (enableRefuelWithoutDistance) {
    // Check for refuels with minimal distance traveled
    for (const result of consumptionResults) {
      if (result.distanceKm < minDistanceBetweenRefuels && result.distanceKm >= 0) {
        const asset = assetInfo.get(result.assetId)
        refuelWithoutDistanceAnomalies.push({
          transactionId: result.transactionId,
          assetId: result.assetId,
          assetNumber: asset?.assetNumber || '',
          transactionDate: result.date,
          quantity: result.quantity,
          distanceKm: result.distanceKm,
        })
      }
    }
  }

  // Count missing odometer transactions
  let missingOdometerCount = 0
  if (enableMissingOdometer) {
    const missingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.fuelTransactions)
      .where(
        and(
          eq(schema.fuelTransactions.organisationId, organisationId),
          isNull(schema.fuelTransactions.odometer),
          gte(schema.fuelTransactions.transactionDate, dateFrom),
        ),
      )
    missingOdometerCount = missingResult[0]?.count ?? 0
  }

  // Create notifications for anomalies (if not dry run)
  let notificationsCreated = 0

  if (!dryRun && sendInAppNotifications) {
    // Get users who should receive notifications (admins and fleet managers)
    const usersToNotify = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.users.organisationId, organisationId),
          sql`${schema.roles.permissions}::jsonb @> '"fuel:alerts:view"' OR ${schema.roles.permissions}::jsonb @> '"admin"'`,
        ),
      )
      .limit(50) // Limit to avoid too many notifications

    // Create notifications for high/low consumption anomalies
    for (const anomaly of anomalies.slice(0, 10)) {
      // Limit to 10 most severe
      for (const user of usersToNotify) {
        await createFuelAnomalyNotification({
          organisationId,
          userId: user.id,
          assetNumber: anomaly.assetNumber,
          assetId: anomaly.assetId,
          anomalyType: anomaly.anomalyType,
          severity: anomaly.severity,
          deviationPercent: anomaly.deviationPercent,
          litersPerHundredKm: anomaly.litersPerHundredKm,
          expectedLitersPer100Km: anomaly.expectedLitersPer100Km,
          transactionDate: anomaly.transactionDate,
        })
        notificationsCreated++
      }
    }

    // Create notifications for refuel without distance
    for (const refuelAnomaly of refuelWithoutDistanceAnomalies.slice(0, 5)) {
      for (const user of usersToNotify) {
        await createFuelAnomalyNotification({
          organisationId,
          userId: user.id,
          assetNumber: refuelAnomaly.assetNumber,
          assetId: refuelAnomaly.assetId,
          anomalyType: 'refuel_without_distance',
          severity: 'warning',
          distanceKm: refuelAnomaly.distanceKm,
          quantity: refuelAnomaly.quantity,
          transactionDate: refuelAnomaly.transactionDate,
        })
        notificationsCreated++
      }
    }
  }

  return {
    success: true,
    dryRun,
    dateRange: {
      from: dateFrom,
      to: dateTo,
    },
    settings: {
      warningThreshold,
      criticalThreshold,
      minDistanceBetweenRefuels,
      enableHighConsumption,
      enableLowConsumption,
      enableRefuelWithoutDistance,
      enableMissingOdometer,
    },
    summary: {
      transactionsAnalyzed: transactions.length,
      consumptionCalculated: consumptionResults.length,
      highConsumptionCount: anomalies.filter((a) => a.anomalyType === 'high_consumption').length,
      lowConsumptionCount: anomalies.filter((a) => a.anomalyType === 'low_consumption').length,
      refuelWithoutDistanceCount: refuelWithoutDistanceAnomalies.length,
      missingOdometerCount,
      criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
      warningCount: anomalies.filter((a) => a.severity === 'warning').length,
      notificationsCreated,
    },
    anomalies: anomalies.slice(0, 20),
    refuelWithoutDistance: refuelWithoutDistanceAnomalies.slice(0, 10),
  }
})
