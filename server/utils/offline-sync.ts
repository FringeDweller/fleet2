import { and, eq, gt, gte, isNotNull, isNull, max, or, sql } from 'drizzle-orm'
import { db, schema } from './db'

/**
 * Sync manifest containing last modified timestamps for each entity type.
 * Used by clients to determine which entities need to be synced.
 */
export interface SyncManifest {
  generatedAt: string
  entities: {
    assets: {
      lastModified: string | null
      count: number
    }
    workOrders: {
      lastModified: string | null
      count: number
    }
    parts: {
      lastModified: string | null
      count: number
    }
  }
}

/**
 * Lightweight asset data for offline cache.
 * Contains essential fields needed for offline read operations.
 */
export interface SyncAsset {
  id: string
  assetNumber: string
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  operationalHours: string | null
  mileage: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  description: string | null
  imageUrl: string | null
  latitude: string | null
  longitude: string | null
  locationName: string | null
  locationAddress: string | null
  categoryId: string | null
  categoryName: string | null
  isArchived: boolean
  deletedAt: string | null
  updatedAt: string
}

/**
 * Lightweight work order data for offline cache.
 */
export interface SyncWorkOrder {
  id: string
  workOrderNumber: string
  assetId: string
  assetNumber: string | null
  assignedToId: string | null
  assigneeName: string | null
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status:
    | 'draft'
    | 'pending_approval'
    | 'open'
    | 'in_progress'
    | 'pending_parts'
    | 'completed'
    | 'closed'
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
  estimatedDuration: number | null
  notes: string | null
  isArchived: boolean
  deletedAt: string | null
  updatedAt: string
}

/**
 * Lightweight parts data for offline cache.
 */
export interface SyncPart {
  id: string
  sku: string
  name: string
  description: string | null
  unit: string
  quantityInStock: string
  minimumStock: string | null
  reorderThreshold: string | null
  unitCost: string | null
  supplier: string | null
  location: string | null
  categoryId: string | null
  categoryName: string | null
  isActive: boolean
  deletedAt: string | null
  updatedAt: string
}

/**
 * Full sync data for initial sync or reset.
 */
export interface FullSyncData {
  syncedAt: string
  assets: SyncAsset[]
  workOrders: SyncWorkOrder[]
  parts: SyncPart[]
}

/**
 * Get sync manifest with last modified timestamps for all syncable entities.
 * Used by clients to check if incremental sync is needed.
 */
export async function getSyncManifest(organisationId: string): Promise<SyncManifest> {
  // Get max updatedAt and count for assets
  const assetStats = await db
    .select({
      lastModified: max(schema.assets.updatedAt),
      count: sql<number>`count(*)::int`,
    })
    .from(schema.assets)
    .where(eq(schema.assets.organisationId, organisationId))

  // Get max updatedAt and count for work orders
  const workOrderStats = await db
    .select({
      lastModified: max(schema.workOrders.updatedAt),
      count: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .where(eq(schema.workOrders.organisationId, organisationId))

  // Get max updatedAt and count for parts
  const partStats = await db
    .select({
      lastModified: max(schema.parts.updatedAt),
      count: sql<number>`count(*)::int`,
    })
    .from(schema.parts)
    .where(eq(schema.parts.organisationId, organisationId))

  return {
    generatedAt: new Date().toISOString(),
    entities: {
      assets: {
        lastModified: assetStats[0]?.lastModified?.toISOString() ?? null,
        count: assetStats[0]?.count ?? 0,
      },
      workOrders: {
        lastModified: workOrderStats[0]?.lastModified?.toISOString() ?? null,
        count: workOrderStats[0]?.count ?? 0,
      },
      parts: {
        lastModified: partStats[0]?.lastModified?.toISOString() ?? null,
        count: partStats[0]?.count ?? 0,
      },
    },
  }
}

/**
 * Get assets modified since a given timestamp.
 * Includes archived/deleted records so clients can remove them from cache.
 */
export async function getModifiedAssets(
  organisationId: string,
  since: Date | null,
  limit = 500,
): Promise<SyncAsset[]> {
  const conditions = [eq(schema.assets.organisationId, organisationId)]

  if (since) {
    conditions.push(gt(schema.assets.updatedAt, since))
  }

  const assets = await db.query.assets.findMany({
    where: and(...conditions),
    with: {
      category: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (assets, { asc }) => [asc(assets.updatedAt)],
    limit,
  })

  return assets.map((asset) => ({
    id: asset.id,
    assetNumber: asset.assetNumber,
    vin: asset.vin,
    make: asset.make,
    model: asset.model,
    year: asset.year,
    licensePlate: asset.licensePlate,
    operationalHours: asset.operationalHours,
    mileage: asset.mileage,
    status: asset.status,
    description: asset.description,
    imageUrl: asset.imageUrl,
    latitude: asset.latitude,
    longitude: asset.longitude,
    locationName: asset.locationName,
    locationAddress: asset.locationAddress,
    categoryId: asset.categoryId,
    categoryName: asset.category?.name ?? null,
    isArchived: asset.isArchived,
    // Use archivedAt as a proxy for deletedAt for soft-deleted records
    deletedAt: asset.archivedAt?.toISOString() ?? null,
    updatedAt: asset.updatedAt.toISOString(),
  }))
}

/**
 * Get work orders modified since a given timestamp.
 * Includes archived/deleted records so clients can remove them from cache.
 */
export async function getModifiedWorkOrders(
  organisationId: string,
  since: Date | null,
  limit = 500,
): Promise<SyncWorkOrder[]> {
  const conditions = [eq(schema.workOrders.organisationId, organisationId)]

  if (since) {
    conditions.push(gt(schema.workOrders.updatedAt, since))
  }

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: {
        columns: {
          assetNumber: true,
        },
      },
      assignee: {
        columns: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (workOrders, { asc }) => [asc(workOrders.updatedAt)],
    limit,
  })

  return workOrders.map((wo) => ({
    id: wo.id,
    workOrderNumber: wo.workOrderNumber,
    assetId: wo.assetId,
    assetNumber: wo.asset?.assetNumber ?? null,
    assignedToId: wo.assignedToId,
    assigneeName: wo.assignee ? `${wo.assignee.firstName} ${wo.assignee.lastName}` : null,
    title: wo.title,
    description: wo.description,
    priority: wo.priority,
    status: wo.status,
    dueDate: wo.dueDate?.toISOString() ?? null,
    startedAt: wo.startedAt?.toISOString() ?? null,
    completedAt: wo.completedAt?.toISOString() ?? null,
    estimatedDuration: wo.estimatedDuration,
    notes: wo.notes,
    isArchived: wo.isArchived,
    // Use archivedAt as a proxy for deletedAt for soft-deleted records
    deletedAt: wo.archivedAt?.toISOString() ?? null,
    updatedAt: wo.updatedAt.toISOString(),
  }))
}

/**
 * Get parts modified since a given timestamp.
 * Includes inactive records so clients can update their cache.
 */
export async function getModifiedParts(
  organisationId: string,
  since: Date | null,
  limit = 500,
): Promise<SyncPart[]> {
  const conditions = [eq(schema.parts.organisationId, organisationId)]

  if (since) {
    conditions.push(gt(schema.parts.updatedAt, since))
  }

  const parts = await db.query.parts.findMany({
    where: and(...conditions),
    with: {
      category: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (parts, { asc }) => [asc(parts.updatedAt)],
    limit,
  })

  return parts.map((part) => ({
    id: part.id,
    sku: part.sku,
    name: part.name,
    description: part.description,
    unit: part.unit,
    quantityInStock: part.quantityInStock,
    minimumStock: part.minimumStock,
    reorderThreshold: part.reorderThreshold,
    unitCost: part.unitCost,
    supplier: part.supplier,
    location: part.location,
    categoryId: part.categoryId,
    categoryName: part.category?.name ?? null,
    isActive: part.isActive,
    // Parts use isActive=false as soft delete, no specific deletedAt
    deletedAt: part.isActive ? null : part.updatedAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }))
}

/**
 * Get full sync data for initial sync or reset.
 * Returns all entities for the organisation.
 */
export async function getFullSyncData(organisationId: string): Promise<FullSyncData> {
  const [assets, workOrders, parts] = await Promise.all([
    getModifiedAssets(organisationId, null, 10000),
    getModifiedWorkOrders(organisationId, null, 10000),
    getModifiedParts(organisationId, null, 10000),
  ])

  return {
    syncedAt: new Date().toISOString(),
    assets,
    workOrders,
    parts,
  }
}
