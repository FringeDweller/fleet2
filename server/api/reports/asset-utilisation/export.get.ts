import { and, eq, gte, lte } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require reports:read permission
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)

  // Filters
  const categoryId = query.categoryId as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const underutilisationThreshold = query.threshold ? parseFloat(query.threshold as string) : 50

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
      categoryName: schema.assetCategories.name,
      operationalHours: schema.assets.operationalHours,
      mileage: schema.assets.mileage,
      status: schema.assets.status,
      make: schema.assets.make,
      model: schema.assets.model,
      year: schema.assets.year,
    })
    .from(schema.assets)
    .leftJoin(schema.assetCategories, eq(schema.assets.categoryId, schema.assetCategories.id))
    .where(whereClause)

  // Calculate fleet averages
  const totalHours = assets.reduce((sum, a) => sum + parseFloat(a.operationalHours || '0'), 0)
  const totalMileage = assets.reduce((sum, a) => sum + parseFloat(a.mileage || '0'), 0)
  const avgHoursPerAsset = assets.length > 0 ? totalHours / assets.length : 0
  const avgMileagePerAsset = assets.length > 0 ? totalMileage / assets.length : 0

  // Generate CSV
  const headers = [
    'Asset Number',
    'Category',
    'Make',
    'Model',
    'Year',
    'Operational Hours',
    'Mileage (km)',
    'Hours vs Fleet Avg (%)',
    'Mileage vs Fleet Avg (%)',
    'Status',
    'Underutilised',
  ]

  const rows = assets.map((asset) => {
    const hours = parseFloat(asset.operationalHours || '0')
    const mileage = parseFloat(asset.mileage || '0')
    const hoursVsAvgPct = avgHoursPerAsset > 0 ? (hours / avgHoursPerAsset) * 100 : 0
    const mileageVsAvgPct = avgMileagePerAsset > 0 ? (mileage / avgMileagePerAsset) * 100 : 0

    const isHoursUnderutilised = avgHoursPerAsset > 0 && hoursVsAvgPct < underutilisationThreshold
    const isMileageUnderutilised =
      avgMileagePerAsset > 0 && mileageVsAvgPct < underutilisationThreshold

    let isUnderutilised = false
    if (avgHoursPerAsset > 0 && avgMileagePerAsset > 0) {
      isUnderutilised = isHoursUnderutilised || isMileageUnderutilised
    } else if (avgHoursPerAsset > 0) {
      isUnderutilised = isHoursUnderutilised
    } else if (avgMileagePerAsset > 0) {
      isUnderutilised = isMileageUnderutilised
    }

    return [
      asset.assetNumber,
      asset.categoryName || '',
      asset.make || '',
      asset.model || '',
      asset.year?.toString() || '',
      hours.toFixed(2),
      mileage.toFixed(2),
      hoursVsAvgPct.toFixed(1),
      mileageVsAvgPct.toFixed(1),
      asset.status,
      isUnderutilised ? 'Yes' : 'No',
    ]
  })

  // Escape CSV values
  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n')

  // Add summary section at the end
  const summarySection = [
    '',
    'Summary',
    `Total Assets,${assets.length}`,
    `Total Hours,${totalHours.toFixed(2)}`,
    `Total Mileage,${totalMileage.toFixed(2)}`,
    `Avg Hours/Asset,${avgHoursPerAsset.toFixed(2)}`,
    `Avg Mileage/Asset,${avgMileagePerAsset.toFixed(2)}`,
    `Underutilisation Threshold,${underutilisationThreshold}%`,
  ].join('\n')

  const fullCsv = `${csvContent}\n${summarySection}`

  // Set response headers for CSV download
  const filename = `asset-utilisation-report-${new Date().toISOString().split('T')[0]}.csv`
  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })

  return fullCsv
})
