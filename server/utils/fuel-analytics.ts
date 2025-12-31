/**
 * Fuel Analytics Utility Functions
 *
 * Provides calculations for:
 * - L/100km (fuel efficiency)
 * - Cost/km
 * - Anomaly detection
 */

export interface FuelConsumptionRecord {
  transactionId: string
  assetId: string
  transactionDate: Date
  quantity: number // Litres
  totalCost: number | null
  odometer: number | null
}

export interface ConsumptionResult {
  transactionId: string
  assetId: string
  date: Date
  quantity: number
  totalCost: number | null
  odometerStart: number
  odometerEnd: number
  distanceKm: number
  litersPerHundredKm: number
  costPerKm: number | null
}

export interface AssetConsumptionSummary {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  totalLitres: number
  totalCost: number
  totalDistanceKm: number
  avgLitersPer100Km: number | null
  avgCostPerKm: number | null
  transactionCount: number
  firstTransaction: Date | null
  lastTransaction: Date | null
}

export interface ConsumptionAnomaly {
  transactionId: string
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  transactionDate: Date
  quantity: number
  totalCost: number | null
  litersPerHundredKm: number
  expectedLitersPer100Km: number
  deviationPercent: number
  anomalyType: 'high_consumption' | 'low_consumption' | 'no_odometer'
  severity: 'warning' | 'critical'
}

/**
 * Calculate fuel consumption (L/100km) between consecutive fuel transactions
 * Requires odometer readings to be present on transactions
 */
export function calculateConsumption(transactions: FuelConsumptionRecord[]): ConsumptionResult[] {
  // Group transactions by asset
  const byAsset = new Map<string, FuelConsumptionRecord[]>()

  for (const t of transactions) {
    if (!byAsset.has(t.assetId)) {
      byAsset.set(t.assetId, [])
    }
    byAsset.get(t.assetId)!.push(t)
  }

  const results: ConsumptionResult[] = []

  // For each asset, sort by date and calculate consumption between consecutive fill-ups
  for (const [assetId, assetTransactions] of byAsset) {
    // Sort by transaction date ascending
    const sorted = assetTransactions
      .filter((t) => t.odometer !== null)
      .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime())

    // Need at least 2 transactions with odometer readings to calculate consumption
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]

      // Skip if either transaction is undefined or missing odometer
      if (!prev || !curr || prev.odometer === null || curr.odometer === null) {
        continue
      }

      const odometerStart = prev.odometer
      const odometerEnd = curr.odometer
      const distanceKm = odometerEnd - odometerStart

      // Skip if distance is zero or negative (odometer reset or error)
      if (distanceKm <= 0) {
        continue
      }

      // L/100km = (litres used / distance) * 100
      const litersPerHundredKm = (curr.quantity / distanceKm) * 100

      // Cost per km = total cost / distance
      const costPerKm = curr.totalCost !== null ? curr.totalCost / distanceKm : null

      results.push({
        transactionId: curr.transactionId,
        assetId,
        date: new Date(curr.transactionDate),
        quantity: curr.quantity,
        totalCost: curr.totalCost,
        odometerStart,
        odometerEnd,
        distanceKm,
        litersPerHundredKm,
        costPerKm,
      })
    }
  }

  return results
}

/**
 * Calculate average consumption per asset
 */
export function calculateAssetAverages(
  consumptionRecords: ConsumptionResult[],
): Map<string, { avgLitersPer100Km: number; avgCostPerKm: number | null; count: number }> {
  const byAsset = new Map<
    string,
    { totalL100: number; totalCostPerKm: number; countL100: number; countCost: number }
  >()

  for (const record of consumptionRecords) {
    if (!byAsset.has(record.assetId)) {
      byAsset.set(record.assetId, {
        totalL100: 0,
        totalCostPerKm: 0,
        countL100: 0,
        countCost: 0,
      })
    }

    const stats = byAsset.get(record.assetId)!
    stats.totalL100 += record.litersPerHundredKm
    stats.countL100 += 1

    if (record.costPerKm !== null) {
      stats.totalCostPerKm += record.costPerKm
      stats.countCost += 1
    }
  }

  const result = new Map<
    string,
    { avgLitersPer100Km: number; avgCostPerKm: number | null; count: number }
  >()

  for (const [assetId, stats] of byAsset) {
    result.set(assetId, {
      avgLitersPer100Km: stats.countL100 > 0 ? stats.totalL100 / stats.countL100 : 0,
      avgCostPerKm: stats.countCost > 0 ? stats.totalCostPerKm / stats.countCost : null,
      count: stats.countL100,
    })
  }

  return result
}

/**
 * Detect anomalies in fuel consumption
 * An anomaly is defined as consumption that deviates significantly from the asset's average
 *
 * @param consumptionRecords - Calculated consumption records
 * @param assetInfo - Map of asset info (assetNumber, make, model)
 * @param warningThresholdPercent - Deviation % to flag as warning (default 30%)
 * @param criticalThresholdPercent - Deviation % to flag as critical (default 50%)
 */
export function detectAnomalies(
  consumptionRecords: ConsumptionResult[],
  assetInfo: Map<string, { assetNumber: string; make: string | null; model: string | null }>,
  warningThresholdPercent = 30,
  criticalThresholdPercent = 50,
): ConsumptionAnomaly[] {
  const averages = calculateAssetAverages(consumptionRecords)
  const anomalies: ConsumptionAnomaly[] = []

  for (const record of consumptionRecords) {
    const assetStats = averages.get(record.assetId)
    const asset = assetInfo.get(record.assetId)

    if (!assetStats || assetStats.count < 3 || !asset) {
      // Need at least 3 records to establish a baseline
      continue
    }

    const expectedL100 = assetStats.avgLitersPer100Km
    const actualL100 = record.litersPerHundredKm

    // Calculate deviation percentage
    const deviationPercent = ((actualL100 - expectedL100) / expectedL100) * 100

    // Check for anomalies
    const absDeviation = Math.abs(deviationPercent)

    if (absDeviation >= warningThresholdPercent) {
      const anomalyType = deviationPercent > 0 ? 'high_consumption' : 'low_consumption'
      const severity = absDeviation >= criticalThresholdPercent ? 'critical' : 'warning'

      anomalies.push({
        transactionId: record.transactionId,
        assetId: record.assetId,
        assetNumber: asset.assetNumber,
        make: asset.make,
        model: asset.model,
        transactionDate: record.date,
        quantity: record.quantity,
        totalCost: record.totalCost,
        litersPerHundredKm: actualL100,
        expectedLitersPer100Km: expectedL100,
        deviationPercent,
        anomalyType,
        severity,
      })
    }
  }

  // Sort by deviation (most severe first)
  return anomalies.sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
}

/**
 * Group consumption data by time period for trend analysis
 */
export function groupConsumptionByPeriod(
  consumptionRecords: ConsumptionResult[],
  period: 'daily' | 'weekly' | 'monthly',
): Map<
  string,
  {
    periodKey: string
    totalLitres: number
    totalCost: number
    totalDistanceKm: number
    avgLitersPer100Km: number
    avgCostPerKm: number | null
    count: number
  }
> {
  const grouped = new Map<
    string,
    {
      periodKey: string
      totalLitres: number
      totalCost: number
      totalDistanceKm: number
      totalL100: number
      totalCostPerKm: number
      countL100: number
      countCost: number
    }
  >()

  for (const record of consumptionRecords) {
    const date = new Date(record.date)
    let periodKey: string

    switch (period) {
      case 'daily':
        periodKey = date.toISOString().split('T')[0] ?? ''
        break
      case 'weekly': {
        // Get ISO week
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + 4 - (d.getDay() || 7))
        const yearStart = new Date(d.getFullYear(), 0, 1)
        const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
        periodKey = `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`
        break
      }
      case 'monthly':
        periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        break
    }

    if (!grouped.has(periodKey)) {
      grouped.set(periodKey, {
        periodKey,
        totalLitres: 0,
        totalCost: 0,
        totalDistanceKm: 0,
        totalL100: 0,
        totalCostPerKm: 0,
        countL100: 0,
        countCost: 0,
      })
    }

    const stats = grouped.get(periodKey)!
    stats.totalLitres += record.quantity
    stats.totalCost += record.totalCost ?? 0
    stats.totalDistanceKm += record.distanceKm
    stats.totalL100 += record.litersPerHundredKm
    stats.countL100 += 1

    if (record.costPerKm !== null) {
      stats.totalCostPerKm += record.costPerKm
      stats.countCost += 1
    }
  }

  // Convert to final format
  const result = new Map<
    string,
    {
      periodKey: string
      totalLitres: number
      totalCost: number
      totalDistanceKm: number
      avgLitersPer100Km: number
      avgCostPerKm: number | null
      count: number
    }
  >()

  for (const [key, stats] of grouped) {
    result.set(key, {
      periodKey: stats.periodKey,
      totalLitres: stats.totalLitres,
      totalCost: stats.totalCost,
      totalDistanceKm: stats.totalDistanceKm,
      avgLitersPer100Km: stats.countL100 > 0 ? stats.totalL100 / stats.countL100 : 0,
      avgCostPerKm: stats.countCost > 0 ? stats.totalCostPerKm / stats.countCost : null,
      count: stats.countL100,
    })
  }

  return result
}
