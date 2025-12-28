import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const scanCheckpointSchema = z.object({
  // Either provide the checkpoint definition ID directly or scan data
  checkpointDefinitionId: z.string().uuid().optional(),
  scanData: z.string().optional(),
  scanMethod: z.enum(['qr_code', 'nfc', 'manual_override']),

  // Optional GPS coordinates
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

/**
 * POST /api/inspections/:id/scan-checkpoint
 *
 * Record a checkpoint scan during an inspection.
 * The scan is validated against the checkpoint definitions for the asset's category.
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

  const body = await readBody(event)
  const result = scanCheckpointSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify inspection exists and is in progress
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
    },
  })

  if (!inspection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection not found',
    })
  }

  if (inspection.status !== 'in_progress') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot scan checkpoint for inspection with status: ${inspection.status}`,
    })
  }

  let checkpointDefinitionId = result.data.checkpointDefinitionId
  const scanData = result.data.scanData

  // If scan data is provided, find the matching checkpoint definition
  if (!checkpointDefinitionId && scanData) {
    // Try to parse the scan data - could be QR code or NFC tag identifier
    const checkpoint = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.isActive, true),
        // Match by QR code or NFC tag
        // The scan data should match either the qrCode or nfcTag field
      ),
    })

    // Try finding by QR code first
    const byQr = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.isActive, true),
        eq(schema.inspectionCheckpointDefinitions.qrCode, scanData),
      ),
    })

    if (byQr) {
      checkpointDefinitionId = byQr.id
    } else {
      // Try by NFC tag
      const byNfc = await db.query.inspectionCheckpointDefinitions.findFirst({
        where: and(
          eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
          eq(schema.inspectionCheckpointDefinitions.isActive, true),
          eq(schema.inspectionCheckpointDefinitions.nfcTag, scanData),
        ),
      })

      if (byNfc) {
        checkpointDefinitionId = byNfc.id
      }
    }
  }

  if (!checkpointDefinitionId) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Could not identify checkpoint from scan data. Please try again or use manual override.',
    })
  }

  // Verify the checkpoint definition exists and belongs to the asset's category
  const checkpointDefinition = await db.query.inspectionCheckpointDefinitions.findFirst({
    where: and(
      eq(schema.inspectionCheckpointDefinitions.id, checkpointDefinitionId),
      eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
    ),
  })

  if (!checkpointDefinition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Checkpoint definition not found',
    })
  }

  // Verify the checkpoint is for the correct asset category
  if (
    inspection.asset.categoryId &&
    checkpointDefinition.assetCategoryId !== inspection.asset.categoryId
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This checkpoint is not configured for this asset category',
    })
  }

  // Check if this checkpoint was already scanned for this inspection
  const existingScan = await db.query.inspectionCheckpointScans.findFirst({
    where: and(
      eq(schema.inspectionCheckpointScans.inspectionId, inspectionId),
      eq(schema.inspectionCheckpointScans.checkpointDefinitionId, checkpointDefinitionId),
    ),
  })

  if (existingScan) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This checkpoint has already been scanned for this inspection',
    })
  }

  // Record the scan
  const [scan] = await db
    .insert(schema.inspectionCheckpointScans)
    .values({
      inspectionId,
      checkpointDefinitionId,
      scannedAt: new Date(),
      scannedById: session.user.id,
      scanData: scanData || null,
      scanMethod: result.data.scanMethod,
      latitude: result.data.latitude?.toString(),
      longitude: result.data.longitude?.toString(),
    })
    .returning()

  // Return the scan with checkpoint details
  const scanWithDetails = await db.query.inspectionCheckpointScans.findFirst({
    where: eq(schema.inspectionCheckpointScans.id, scan!.id),
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
  })

  return scanWithDetails
})
