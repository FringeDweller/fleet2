import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { InspectionChecklistItem } from '../../db/schema/inspection-templates'
import { db, schema } from '../../utils/db'
import { parseInspectionQRCodeData } from '../../utils/inspection-qr'

const startInspectionSchema = z.object({
  // Either provide assetId directly (manual) or scanData (NFC/QR)
  assetId: z.string().uuid().optional(),
  scanData: z.string().optional(),
  initiationMethod: z.enum(['nfc', 'qr_code', 'manual']),

  // GPS location at start
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(255).optional(),
  locationAccuracy: z.number().min(0).optional(),

  // Offline sync support
  offlineData: z
    .object({
      clientId: z.string().uuid(),
      capturedAt: z.string(),
      deviceInfo: z
        .object({
          platform: z.string().optional(),
          model: z.string().optional(),
          osVersion: z.string().optional(),
        })
        .optional(),
      wasOffline: z.boolean(),
    })
    .optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  const body = await readBody(event)
  const result = startInspectionSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  let assetId = result.data.assetId
  const scanData = result.data.scanData

  // If scan data is provided, parse it to extract asset ID
  if (result.data.initiationMethod !== 'manual' && scanData) {
    const parsedData = parseInspectionQRCodeData(scanData)

    if (!parsedData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid scan data',
      })
    }

    // Validate organisation matches
    if (parsedData.orgId !== user.organisationId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Asset belongs to a different organisation',
      })
    }

    assetId = parsedData.assetId
  }

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required (either directly or via scan data)',
    })
  }

  // Verify asset belongs to organisation and get category
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    with: {
      category: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Find the active operator session for this operator and asset
  const activeSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.operatorId, user.id),
      eq(schema.operatorSessions.assetId, assetId),
      eq(schema.operatorSessions.status, 'active'),
    ),
  })

  // Find the appropriate inspection template
  // Priority: 1) Template for specific category, 2) Generic template for the org
  let template = null

  if (asset.categoryId) {
    // First try to find a template for the specific asset category
    template = await db.query.inspectionTemplates.findFirst({
      where: and(
        eq(schema.inspectionTemplates.organisationId, user.organisationId),
        eq(schema.inspectionTemplates.categoryId, asset.categoryId),
        eq(schema.inspectionTemplates.isActive, true),
      ),
    })
  }

  // If no category-specific template, try to find a generic one (no category)
  if (!template) {
    template = await db.query.inspectionTemplates.findFirst({
      where: and(
        eq(schema.inspectionTemplates.organisationId, user.organisationId),
        eq(schema.inspectionTemplates.isActive, true),
      ),
    })
  }

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No inspection template found for this asset category',
    })
  }

  // Start time - use offline captured time if provided, otherwise now
  const startedAt = result.data.offlineData?.capturedAt
    ? new Date(result.data.offlineData.capturedAt)
    : new Date()

  // Create inspection and initial items in a transaction
  const inspection = await db.transaction(async (tx) => {
    // Create the inspection record
    const [newInspection] = await tx
      .insert(schema.inspections)
      .values({
        organisationId: user.organisationId,
        assetId,
        templateId: template!.id,
        operatorId: user.id,
        operatorSessionId: activeSession?.id || null,
        initiationMethod: result.data.initiationMethod,
        scanData: scanData || null,
        startedAt,
        latitude: result.data.latitude?.toString(),
        longitude: result.data.longitude?.toString(),
        locationName: result.data.locationName,
        locationAccuracy: result.data.locationAccuracy?.toString(),
        status: 'in_progress',
        syncStatus: result.data.offlineData ? 'pending' : 'synced',
        offlineData: result.data.offlineData || null,
      })
      .returning()

    // Create inspection items based on template checklist
    const checklistItems = (template!.checklistItems as InspectionChecklistItem[]) || []

    if (checklistItems.length > 0) {
      await tx.insert(schema.inspectionItems).values(
        checklistItems.map((item) => ({
          inspectionId: newInspection!.id,
          checklistItemId: item.id,
          checklistItemLabel: item.label,
          checklistItemType: item.type,
          result: 'pending' as const,
        })),
      )
    }

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'create',
      entityType: 'inspection',
      entityId: newInspection!.id,
      newValues: newInspection,
    })

    return newInspection
  })

  // Fetch the complete inspection with relations
  const fullInspection = await db.query.inspections.findFirst({
    where: eq(schema.inspections.id, inspection!.id),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      template: {
        columns: {
          id: true,
          name: true,
          checklistItems: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          startTime: true,
          status: true,
        },
      },
      items: true,
    },
  })

  return fullInspection
})
