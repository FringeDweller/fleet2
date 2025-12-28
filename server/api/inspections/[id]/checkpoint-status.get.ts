import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/inspections/:id/checkpoint-status
 *
 * Get the checkpoint scan status for an inspection.
 * Returns which checkpoints are required, which have been scanned,
 * and whether all required checkpoints are complete.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const inspectionId = getRouterParam(event, 'id')

  if (!inspectionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inspection ID is required',
    })
  }

  // Get the inspection with asset category
  const inspection = await db.query.inspections.findFirst({
    where: and(
      eq(schema.inspections.id, inspectionId),
      eq(schema.inspections.organisationId, session.user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          categoryId: true,
        },
      },
      checkpointScans: {
        with: {
          checkpointDefinition: {
            columns: {
              id: true,
              name: true,
              position: true,
              required: true,
            },
          },
          scannedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  if (!inspection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection not found',
    })
  }

  // If no asset category, there are no checkpoints to scan
  if (!inspection.asset.categoryId) {
    return {
      inspectionId,
      hasCheckpoints: false,
      checkpoints: [],
      scannedCheckpoints: [],
      requiredCheckpoints: [],
      missingRequiredCheckpoints: [],
      allRequiredComplete: true,
      progress: {
        total: 0,
        scanned: 0,
        required: 0,
        requiredScanned: 0,
        percentage: 100,
      },
    }
  }

  // Get all checkpoint definitions for this asset category
  const checkpointDefinitions = await db.query.inspectionCheckpointDefinitions.findMany({
    where: and(
      eq(schema.inspectionCheckpointDefinitions.assetCategoryId, inspection.asset.categoryId),
      eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
      eq(schema.inspectionCheckpointDefinitions.isActive, true),
    ),
    orderBy: (table, { asc }) => [asc(table.displayOrder), asc(table.name)],
  })

  // Create a map of scanned checkpoint IDs
  const scannedCheckpointIds = new Set(
    inspection.checkpointScans.map((s) => s.checkpointDefinitionId),
  )

  // Build checkpoint status list
  const checkpoints = checkpointDefinitions.map((def) => {
    const scan = inspection.checkpointScans.find((s) => s.checkpointDefinitionId === def.id)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      position: def.position,
      required: def.required,
      scanned: !!scan,
      scan: scan
        ? {
            id: scan.id,
            scannedAt: scan.scannedAt,
            scanMethod: scan.scanMethod,
            scannedBy: scan.scannedBy,
          }
        : null,
    }
  })

  const requiredCheckpoints = checkpoints.filter((c) => c.required)
  const missingRequiredCheckpoints = requiredCheckpoints.filter((c) => !c.scanned)
  const scannedCheckpoints = checkpoints.filter((c) => c.scanned)

  const requiredCount = requiredCheckpoints.length
  const requiredScannedCount = requiredCheckpoints.filter((c) => c.scanned).length
  const allRequiredComplete = missingRequiredCheckpoints.length === 0

  return {
    inspectionId,
    hasCheckpoints: checkpointDefinitions.length > 0,
    checkpoints,
    scannedCheckpoints,
    requiredCheckpoints,
    missingRequiredCheckpoints,
    allRequiredComplete,
    progress: {
      total: checkpointDefinitions.length,
      scanned: scannedCheckpoints.length,
      required: requiredCount,
      requiredScanned: requiredScannedCount,
      percentage:
        checkpointDefinitions.length > 0
          ? Math.round((scannedCheckpoints.length / checkpointDefinitions.length) * 100)
          : 100,
    },
  }
})
