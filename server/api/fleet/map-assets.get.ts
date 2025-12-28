import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export interface MapAsset {
  assetId: string
  assetNumber: string
  assetName: string
  categoryId: string | null
  categoryName: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  latitude: number | null
  longitude: number | null
  locationName: string | null
  locationAddress: string | null
  lastLocationUpdate: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  imageUrl: string | null
  hasLocation: boolean
}

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filter options
  const status = query.status as string | undefined
  const categoryId = query.categoryId as string | undefined
  const search = query.search as string | undefined

  const conditions = [
    eq(schema.assets.organisationId, user.organisationId),
    eq(schema.assets.isArchived, false),
  ]

  // Status filter
  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(
      eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed'),
    )
  }

  // Category filter
  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

  const assets = await db.query.assets.findMany({
    where: and(...conditions),
    with: {
      category: true,
    },
    orderBy: (assets, { asc }) => [asc(assets.assetNumber)],
  })

  // Apply search filter on results (client-side for simplicity with small datasets)
  let filteredAssets = assets
  if (search) {
    const searchLower = search.toLowerCase()
    filteredAssets = assets.filter(
      (asset) =>
        asset.assetNumber.toLowerCase().includes(searchLower) ||
        asset.make?.toLowerCase().includes(searchLower) ||
        asset.model?.toLowerCase().includes(searchLower) ||
        asset.licensePlate?.toLowerCase().includes(searchLower) ||
        asset.locationName?.toLowerCase().includes(searchLower),
    )
  }

  // Transform to MapAsset format
  const mapAssets: MapAsset[] = filteredAssets.map((asset) => {
    // Type assertion for category relation
    const category = asset.category as { name: string } | null | undefined
    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: `${asset.make || ''} ${asset.model || ''}`.trim() || asset.assetNumber,
      categoryId: asset.categoryId,
      categoryName: category?.name || null,
      status: asset.status,
      latitude: asset.latitude ? parseFloat(asset.latitude as string) : null,
      longitude: asset.longitude ? parseFloat(asset.longitude as string) : null,
      locationName: asset.locationName,
      locationAddress: asset.locationAddress,
      lastLocationUpdate: asset.lastLocationUpdate?.toISOString() || null,
      make: asset.make,
      model: asset.model,
      year: asset.year,
      licensePlate: asset.licensePlate,
      imageUrl: asset.imageUrl,
      hasLocation: asset.latitude !== null && asset.longitude !== null,
    }
  })

  // Summary stats by status
  const statusCounts = {
    active: mapAssets.filter((a) => a.status === 'active').length,
    inactive: mapAssets.filter((a) => a.status === 'inactive').length,
    maintenance: mapAssets.filter((a) => a.status === 'maintenance').length,
    disposed: mapAssets.filter((a) => a.status === 'disposed').length,
  }

  const withLocation = mapAssets.filter((a) => a.hasLocation).length

  return {
    assets: mapAssets,
    stats: {
      total: mapAssets.length,
      withLocation,
      withoutLocation: mapAssets.length - withLocation,
      byStatus: statusCounts,
    },
  }
})
