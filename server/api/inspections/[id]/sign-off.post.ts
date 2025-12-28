import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

/**
 * Sign-off inspection API endpoint (US-9.4)
 *
 * Allows completing an inspection with a digital signature and declaration acceptance.
 * The signature is stored as a base64 data URL which should be uploaded to storage
 * in a production environment.
 */

const signOffSchema = z.object({
  // Base64 encoded signature image (data URL format: data:image/png;base64,...)
  signatureData: z.string().min(1, 'Signature is required'),
  // Declaration text that was displayed to the user
  declarationText: z.string().min(1, 'Declaration text is required'),
  // Confirmation that the user accepted the declaration
  declarationAccepted: z.literal(true, {
    message: 'Declaration must be accepted',
  }),
  // Optional notes for the inspection
  notes: z.string().optional(),
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
  const inspectionId = getRouterParam(event, 'id')

  if (!inspectionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inspection ID is required',
    })
  }

  const body = await readBody(event)
  const result = signOffSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify inspection exists and belongs to organisation
  const inspection = await db.query.inspections.findFirst({
    where: and(
      eq(schema.inspections.id, inspectionId),
      eq(schema.inspections.organisationId, user.organisationId),
    ),
    with: {
      items: true,
    },
  })

  if (!inspection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection not found',
    })
  }

  // Check if inspection is still in progress
  if (inspection.status !== 'in_progress') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot sign off inspection with status: ${inspection.status}`,
    })
  }

  // Verify all items have been responded to (not pending)
  const pendingItems = inspection.items.filter((item) => item.result === 'pending')
  if (pendingItems.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot sign off: ${pendingItems.length} item(s) have not been responded to`,
    })
  }

  // Validate signature data format (should be a base64 data URL)
  const signatureDataUrl = result.data.signatureData
  if (!signatureDataUrl.startsWith('data:image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid signature format. Expected a base64 image data URL.',
    })
  }

  const now = new Date()

  // Calculate overall result from items
  const hasFailures = inspection.items.some((item) => item.result === 'fail')
  const overallResult = hasFailures ? 'fail' : 'pass'

  // Update inspection with sign-off details in a transaction
  const updatedInspection = await db.transaction(async (tx) => {
    // In a production environment, you would upload the signature to cloud storage
    // and store the URL. For now, we store the base64 data URL directly.
    // This could be extracted to a separate upload service.
    const signatureUrl = signatureDataUrl

    // Update inspection with sign-off data
    await tx
      .update(schema.inspections)
      .set({
        status: 'completed',
        completedAt: now,
        signatureUrl,
        declarationText: result.data.declarationText,
        signedAt: now,
        signedById: user.id,
        notes: result.data.notes,
        overallResult,
        syncStatus: 'synced',
        updatedAt: now,
      })
      .where(eq(schema.inspections.id, inspectionId))

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'sign_off',
      entityType: 'inspection',
      entityId: inspectionId,
      newValues: {
        signedAt: now.toISOString(),
        signedById: user.id,
        overallResult,
        declarationAccepted: true,
      },
    })

    // Return updated inspection with relations
    return tx.query.inspections.findFirst({
      where: eq(schema.inspections.id, inspectionId),
      with: {
        asset: {
          columns: {
            id: true,
            assetNumber: true,
            make: true,
            model: true,
          },
        },
        operator: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        signedBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: true,
      },
    })
  })

  return updatedInspection
})
