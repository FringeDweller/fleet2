/**
 * Maintenance Cost Report API (US-14.4)
 *
 * GET /api/reports/maintenance-costs
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - assetId: (optional) filter by specific asset
 * - categoryId: (optional) filter by asset category
 *
 * Returns:
 * - assetCosts: array of per-asset cost breakdowns with $/hour and $/km
 * - totals: summary totals
 * - trendData: monthly cost breakdown for charts
 */

import { and, desc, eq, gte, lte, type SQL, sql, sum } from 'drizzle-orm'
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
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const assetId = query.assetId as string | undefined
  const categoryId = query.categoryId as string | undefined

  // Build base conditions for work orders
  const workOrderConditions: SQL[] = [
    eq(schema.workOrders.organisationId, session.user.organisationId),
    eq(schema.workOrders.status, 'completed'),
  ]

  // Add date range filters
  if (startDate) {
    workOrderConditions.push(gte(schema.workOrders.completedAt, new Date(startDate)))
  }

  if (endDate) {
    workOrderConditions.push(lte(schema.workOrders.completedAt, new Date(endDate)))
  }

  // Add asset filter
  if (assetId) {
    workOrderConditions.push(eq(schema.workOrders.assetId, assetId))
  }

  // Build asset conditions (for category filter)
  const assetConditions: SQL[] = []
  if (categoryId) {
    assetConditions.push(eq(schema.assets.categoryId, categoryId))
  }

  // Combine all conditions
  const allConditions = [...workOrderConditions, ...assetConditions]
  const whereClause = and(...allConditions)

  // Get per-asset cost breakdown
  const assetCostsResult = await db
    .select({
      assetId: schema.workOrders.assetId,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
      categoryId: schema.assets.categoryId,
      categoryName: schema.assetCategories.name,
      operationalHours: schema.assets.operationalHours,
      mileage: schema.assets.mileage,
      laborCost: sum(schema.workOrders.laborCost),
      partsCost: sum(schema.workOrders.partsCost),
      totalCost: sum(schema.workOrders.totalCost),
      workOrderCount: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .leftJoin(schema.assetCategories, eq(schema.assets.categoryId, schema.assetCategories.id))
    .where(whereClause)
    .groupBy(
      schema.workOrders.assetId,
      schema.assets.assetNumber,
      schema.assets.make,
      schema.assets.model,
      schema.assets.categoryId,
      schema.assetCategories.name,
      schema.assets.operationalHours,
      schema.assets.mileage,
    )
    .orderBy(desc(sum(schema.workOrders.totalCost)))

  // Calculate per-asset metrics including cost/hour and cost/km
  const assetCosts = assetCostsResult.map((row) => {
    const laborCost = Number.parseFloat(row.laborCost || '0')
    const partsCost = Number.parseFloat(row.partsCost || '0')
    const totalCost = Number.parseFloat(row.totalCost || '0')
    const hours = Number.parseFloat(row.operationalHours || '0')
    const mileage = Number.parseFloat(row.mileage || '0')

    return {
      assetId: row.assetId,
      assetNumber: row.assetNumber,
      make: row.make,
      model: row.model,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      laborCost,
      partsCost,
      totalCost,
      workOrderCount: row.workOrderCount,
      hours,
      mileage,
      costPerHour: hours > 0 ? totalCost / hours : null,
      costPerKm: mileage > 0 ? totalCost / mileage : null,
    }
  })

  // Calculate totals
  const totals = assetCosts.reduce(
    (acc, asset) => ({
      totalLabor: acc.totalLabor + asset.laborCost,
      totalParts: acc.totalParts + asset.partsCost,
      grandTotal: acc.grandTotal + asset.totalCost,
      totalWorkOrders: acc.totalWorkOrders + asset.workOrderCount,
      assetCount: acc.assetCount + 1,
    }),
    { totalLabor: 0, totalParts: 0, grandTotal: 0, totalWorkOrders: 0, assetCount: 0 },
  )

  // Calculate average cost per asset
  const avgCostPerAsset = totals.assetCount > 0 ? totals.grandTotal / totals.assetCount : 0

  // Get monthly trend data for charts
  const trendData = await db
    .select({
      month: sql<string>`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`,
      laborCost: sum(schema.workOrders.laborCost),
      partsCost: sum(schema.workOrders.partsCost),
      totalCost: sum(schema.workOrders.totalCost),
      workOrderCount: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .where(whereClause)
    .groupBy(sql`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`)

  const trendDataFormatted = trendData.map((row) => ({
    period: row.month,
    laborCost: Number.parseFloat(row.laborCost || '0'),
    partsCost: Number.parseFloat(row.partsCost || '0'),
    totalCost: Number.parseFloat(row.totalCost || '0'),
    workOrderCount: row.workOrderCount,
  }))

  // Get labor vs parts breakdown for pie chart
  const laborVsParts = {
    labor: totals.totalLabor,
    parts: totals.totalParts,
    laborPercent: totals.grandTotal > 0 ? (totals.totalLabor / totals.grandTotal) * 100 : 0,
    partsPercent: totals.grandTotal > 0 ? (totals.totalParts / totals.grandTotal) * 100 : 0,
  }

  // Get top 5 highest cost assets for highlighting
  const highCostAssets = assetCosts.slice(0, 5).map((a) => a.assetId)

  return {
    assetCosts,
    totals: {
      ...totals,
      avgCostPerAsset,
    },
    trendData: trendDataFormatted,
    laborVsParts,
    highCostAssets,
  }
})
