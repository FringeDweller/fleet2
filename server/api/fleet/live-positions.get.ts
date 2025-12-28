import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export interface FleetPosition {
  assetId: string
  assetNumber: string
  assetName: string
  categoryId: string | null
  categoryName: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  latitude: number
  longitude: number
  locationName: string | null
  locationAddress: string | null
  lastLocationUpdate: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  mileage: string | null
  operationalHours: string | null
  imageUrl: string | null
}

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filter options
  const status = query.status as string | undefined
  const categoryId = query.categoryId as string | undefined
  const activeOnly = query.activeOnly === 'true'

  const conditions = [
    eq(schema.assets.organisationId, user.organisationId),
    eq(schema.assets.isArchived, false),
    // Only assets with location data
    isNotNull(schema.assets.latitude),
    isNotNull(schema.assets.longitude),
  ]

  // Status filter
  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(
      eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed'),
    )
  } else if (activeOnly) {
    // Only show active assets
    conditions.push(eq(schema.assets.status, 'active'))
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
    orderBy: (assets, { desc }) => [desc(assets.lastLocationUpdate)],
  })

  // Transform to FleetPosition format
  const positions: FleetPosition[] = assets.map((asset) => {
    // Type assertion for category relation
    const category = asset.category as { name: string } | null | undefined
    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: `${asset.make || ''} ${asset.model || ''}`.trim() || asset.assetNumber,
      categoryId: asset.categoryId,
      categoryName: category?.name || null,
      status: asset.status,
      latitude: parseFloat(asset.latitude as string),
      longitude: parseFloat(asset.longitude as string),
      locationName: asset.locationName,
      locationAddress: asset.locationAddress,
      lastLocationUpdate: asset.lastLocationUpdate?.toISOString() || null,
      make: asset.make,
      model: asset.model,
      year: asset.year,
      licensePlate: asset.licensePlate,
      mileage: asset.mileage,
      operationalHours: asset.operationalHours,
      imageUrl: asset.imageUrl,
    }
  })

  // Get summary statistics
  const allAssets = await db
    .select({
      total: sql<number>`count(*)::int`,
      withLocation: sql<number>`count(*) filter (where ${schema.assets.latitude} is not null and ${schema.assets.longitude} is not null)::int`,
      active: sql<number>`count(*) filter (where ${schema.assets.status} = 'active')::int`,
      activeWithLocation: sql<number>`count(*) filter (where ${schema.assets.status} = 'active' and ${schema.assets.latitude} is not null and ${schema.assets.longitude} is not null)::int`,
    })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assets.isArchived, false),
      ),
    )

  const stats = allAssets[0] || { total: 0, withLocation: 0, active: 0, activeWithLocation: 0 }

  return {
    positions,
    stats: {
      totalAssets: stats.total,
      assetsWithLocation: stats.withLocation,
      activeAssets: stats.active,
      activeWithLocation: stats.activeWithLocation,
      displayedCount: positions.length,
    },
  }
})
