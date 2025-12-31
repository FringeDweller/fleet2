import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

/**
 * Sync conflict data returned to the client
 */
export interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  localData: Record<string, unknown>
  serverData: Record<string, unknown> | null
  conflictResolution: 'client_wins' | 'server_wins' | 'manual' | 'merge' | null
  createdAt: string
}

/**
 * Response type for the conflicts endpoint
 */
export interface SyncConflictsResponse {
  conflicts: SyncConflict[]
  count: number
}

/**
 * GET /api/sync/conflicts
 *
 * Returns pending sync conflicts for the current user.
 * Queries the pendingChanges table for unresolved conflicts (where syncedAt is null
 * and conflictResolution indicates a conflict that needs resolution).
 *
 * Used by the ConflictModal component to display conflicts to users.
 */
export default defineEventHandler(async (event): Promise<SyncConflictsResponse> => {
  // Require authentication - any authenticated user can view their conflicts
  const user = await requireAuth(event)

  // Query pending changes that are unresolved (syncedAt is null)
  // and have a conflict resolution strategy that requires user action
  const pendingChanges = await db.query.pendingChanges.findMany({
    where: and(eq(schema.pendingChanges.userId, user.id), isNull(schema.pendingChanges.syncedAt)),
    orderBy: (changes, { desc }) => [desc(changes.createdAt)],
  })

  // For each pending change, fetch the current server version of the entity
  const conflicts: SyncConflict[] = await Promise.all(
    pendingChanges.map(async (change) => {
      // Fetch server data based on entity type
      const serverData = await getServerEntityData(
        change.entityType,
        change.entityId,
        user.organisationId,
      )

      return {
        id: change.id,
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        localData: change.payload,
        serverData,
        conflictResolution: change.conflictResolution,
        createdAt: change.createdAt.toISOString(),
      }
    }),
  )

  return {
    conflicts,
    count: conflicts.length,
  }
})

/**
 * Fetch the current server data for an entity.
 * Returns null if the entity doesn't exist on the server.
 */
async function getServerEntityData(
  entityType: string,
  entityId: string,
  organisationId: string,
): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case 'asset': {
      const asset = await db.query.assets.findFirst({
        where: and(
          eq(schema.assets.id, entityId),
          eq(schema.assets.organisationId, organisationId),
        ),
      })
      if (!asset) return null
      return {
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
        isArchived: asset.isArchived,
        updatedAt: asset.updatedAt.toISOString(),
      }
    }

    case 'workOrder': {
      const workOrder = await db.query.workOrders.findFirst({
        where: and(
          eq(schema.workOrders.id, entityId),
          eq(schema.workOrders.organisationId, organisationId),
        ),
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
      })
      if (!workOrder) return null
      return {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        assetId: workOrder.assetId,
        assetNumber: workOrder.asset?.assetNumber ?? null,
        assignedToId: workOrder.assignedToId,
        assigneeName: workOrder.assignee
          ? `${workOrder.assignee.firstName} ${workOrder.assignee.lastName}`
          : null,
        title: workOrder.title,
        description: workOrder.description,
        priority: workOrder.priority,
        status: workOrder.status,
        dueDate: workOrder.dueDate?.toISOString() ?? null,
        startedAt: workOrder.startedAt?.toISOString() ?? null,
        completedAt: workOrder.completedAt?.toISOString() ?? null,
        estimatedDuration: workOrder.estimatedDuration,
        notes: workOrder.notes,
        isArchived: workOrder.isArchived,
        updatedAt: workOrder.updatedAt.toISOString(),
      }
    }

    case 'part': {
      const part = await db.query.parts.findFirst({
        where: and(eq(schema.parts.id, entityId), eq(schema.parts.organisationId, organisationId)),
        with: {
          category: {
            columns: {
              name: true,
            },
          },
        },
      })
      if (!part) return null
      return {
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
        updatedAt: part.updatedAt.toISOString(),
      }
    }

    case 'inspection': {
      const inspection = await db.query.inspections.findFirst({
        where: and(
          eq(schema.inspections.id, entityId),
          eq(schema.inspections.organisationId, organisationId),
        ),
      })
      if (!inspection) return null
      return {
        id: inspection.id,
        assetId: inspection.assetId,
        templateId: inspection.templateId,
        operatorId: inspection.operatorId,
        status: inspection.status,
        initiationMethod: inspection.initiationMethod,
        notes: inspection.notes,
        overallResult: inspection.overallResult,
        startedAt: inspection.startedAt?.toISOString() ?? null,
        completedAt: inspection.completedAt?.toISOString() ?? null,
        signatureUrl: inspection.signatureUrl,
        signedAt: inspection.signedAt?.toISOString() ?? null,
        updatedAt: inspection.updatedAt.toISOString(),
      }
    }

    case 'defect': {
      const defect = await db.query.defects.findFirst({
        where: and(
          eq(schema.defects.id, entityId),
          eq(schema.defects.organisationId, organisationId),
        ),
      })
      if (!defect) return null
      return {
        id: defect.id,
        assetId: defect.assetId,
        inspectionId: defect.inspectionId,
        title: defect.title,
        severity: defect.severity,
        description: defect.description,
        status: defect.status,
        category: defect.category,
        location: defect.location,
        resolutionNotes: defect.resolutionNotes,
        resolvedById: defect.resolvedById,
        resolvedAt: defect.resolvedAt?.toISOString() ?? null,
        photos: defect.photos,
        updatedAt: defect.updatedAt.toISOString(),
      }
    }

    default:
      // For unknown entity types, return null
      return null
  }
}
