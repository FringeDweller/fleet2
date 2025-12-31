import { and, avg, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

interface AssetUtilisationRow {
  id: string
  assetNumber: string
  categoryId: string | null
  categoryName: string | null
  operationalHours: string | null
  mileage: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  make: string | null
  model: string | null
  year: number | null
  createdAt: Date
}

interface AssetUtilisationReport {
  id: string
  assetNumber: string
  categoryId: string | null
  categoryName: string | null
  operationalHours: number
  mileage: number
  hoursVsAvgPct: number
  mileageVsAvgPct: number
  status: string
  make: string | null
  model: string | null
  year: number | null
  isUnderutilised: boolean
}

export default defineEventHandler(async (event) => {
  // Require reports:read permission
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)

  // Filters
  const categoryId = query.categoryId as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const underutilisationThreshold = query.threshold ? parseFloat(query.threshold as string) : 50 // Default: assets below 50% of fleet average are underutilised

  // Build filter conditions
  const conditions = [
    eq(schema.assets.organisationId, user.organisationId),
    eq(schema.assets.isArchived, false),
  ]

  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

  if (startDate) {
    conditions.push(gte(schema.assets.createdAt, new Date(startDate)))
  }

  if (endDate) {
    conditions.push(lte(schema.assets.createdAt, new Date(endDate)))
  }

  const whereClause = and(...conditions)

  // Get all assets matching filters
  const assets = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      categoryId: schema.assets.categoryId,
      categoryName: schema.assetCategories.name,
      operationalHours: schema.assets.operationalHours,
      mileage: schema.assets.mileage,
      status: schema.assets.status,
      make: schema.assets.make,
      model: schema.assets.model,
      year: schema.assets.year,
      createdAt: schema.assets.createdAt,
    })
    .from(schema.assets)
    .leftJoin(schema.assetCategories, eq(schema.assets.categoryId, schema.assetCategories.id))
    .where(whereClause)

  if (assets.length === 0) {
    return {
      summary: {
        totalAssets: 0,
        totalHours: 0,
        totalMileage: 0,
        avgHoursPerAsset: 0,
        avgMileagePerAsset: 0,
        underutilisedCount: 0,
        underutilisedPct: 0,
      },
      assets: [],
      threshold: underutilisationThreshold,
    }
  }

  // Calculate fleet averages
  const totalHours = assets.reduce((sum, a) => sum + parseFloat(a.operationalHours || '0'), 0)
  const totalMileage = assets.reduce((sum, a) => sum + parseFloat(a.mileage || '0'), 0)
  const avgHoursPerAsset = totalHours / assets.length
  const avgMileagePerAsset = totalMileage / assets.length

  // Map assets with comparison to fleet average
  const assetsWithComparison: AssetUtilisationReport[] = assets.map((asset) => {
    const hours = parseFloat(asset.operationalHours || '0')
    const mileage = parseFloat(asset.mileage || '0')

    // Calculate percentage compared to fleet average
    const hoursVsAvgPct = avgHoursPerAsset > 0 ? (hours / avgHoursPerAsset) * 100 : 0
    const mileageVsAvgPct = avgMileagePerAsset > 0 ? (mileage / avgMileagePerAsset) * 100 : 0

    // Asset is underutilised if both hours AND mileage are below threshold
    // (or just one metric if the other is 0)
    const isHoursUnderutilised = avgHoursPerAsset > 0 && hoursVsAvgPct < underutilisationThreshold
    const isMileageUnderutilised =
      avgMileagePerAsset > 0 && mileageVsAvgPct < underutilisationThreshold

    // If fleet tracks both metrics, check both; otherwise check whichever is tracked
    let isUnderutilised = false
    if (avgHoursPerAsset > 0 && avgMileagePerAsset > 0) {
      // Both metrics tracked - underutilised if either is below threshold
      isUnderutilised = isHoursUnderutilised || isMileageUnderutilised
    } else if (avgHoursPerAsset > 0) {
      isUnderutilised = isHoursUnderutilised
    } else if (avgMileagePerAsset > 0) {
      isUnderutilised = isMileageUnderutilised
    }

    return {
      id: asset.id,
      assetNumber: asset.assetNumber,
      categoryId: asset.categoryId,
      categoryName: asset.categoryName,
      operationalHours: hours,
      mileage: mileage,
      hoursVsAvgPct: Math.round(hoursVsAvgPct * 10) / 10,
      mileageVsAvgPct: Math.round(mileageVsAvgPct * 10) / 10,
      status: asset.status,
      make: asset.make,
      model: asset.model,
      year: asset.year,
      isUnderutilised,
    }
  })

  const underutilisedCount = assetsWithComparison.filter((a) => a.isUnderutilised).length

  return {
    summary: {
      totalAssets: assets.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalMileage: Math.round(totalMileage * 100) / 100,
      avgHoursPerAsset: Math.round(avgHoursPerAsset * 100) / 100,
      avgMileagePerAsset: Math.round(avgMileagePerAsset * 100) / 100,
      underutilisedCount,
      underutilisedPct:
        assets.length > 0 ? Math.round((underutilisedCount / assets.length) * 100 * 10) / 10 : 0,
    },
    assets: assetsWithComparison,
    threshold: underutilisationThreshold,
  }
})
