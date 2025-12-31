/**
 * US-15.6: Update asset document (including expiry date)
 * PUT /api/assets/:id/documents/:docId
 */
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  documentType: z
    .enum([
      'registration',
      'insurance',
      'inspection',
      'certification',
      'manual',
      'warranty',
      'other',
    ])
    .optional(),
  expiryDate: z.string().datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  // Require assets:write permission to update documents
  const currentUser = await requirePermission(event, 'assets:write')

  const assetId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  if (!docId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateDocumentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, currentUser.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Verify document exists and belongs to asset
  const existingDocument = await db.query.assetDocuments.findFirst({
    where: and(eq(schema.assetDocuments.id, docId), eq(schema.assetDocuments.assetId, assetId)),
  })

  if (!existingDocument) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.name !== undefined) {
    updateData.name = result.data.name
  }
  if (result.data.description !== undefined) {
    updateData.description = result.data.description
  }
  if (result.data.documentType !== undefined) {
    updateData.documentType = result.data.documentType
  }
  if (result.data.expiryDate !== undefined) {
    updateData.expiryDate = result.data.expiryDate ? new Date(result.data.expiryDate) : null
  }

  // Store old values for audit
  const oldValues = {
    name: existingDocument.name,
    description: existingDocument.description,
    documentType: existingDocument.documentType,
    expiryDate: existingDocument.expiryDate?.toISOString() || null,
  }

  // Update document
  const [updatedDocument] = await db
    .update(schema.assetDocuments)
    .set(updateData)
    .where(eq(schema.assetDocuments.id, docId))
    .returning()

  if (!updatedDocument) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update document',
    })
  }

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'update',
    entityType: 'asset_document',
    entityId: docId,
    oldValues,
    newValues: {
      name: updatedDocument.name,
      description: updatedDocument.description,
      documentType: updatedDocument.documentType,
      expiryDate: updatedDocument.expiryDate?.toISOString() || null,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  // Calculate expiry status for response
  const now = new Date()
  let expiryStatus: 'expired' | 'expiring_soon' | 'valid' | null = null

  if (updatedDocument.expiryDate) {
    const daysUntilExpiry = Math.ceil(
      (updatedDocument.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysUntilExpiry < 0) {
      expiryStatus = 'expired'
    } else if (daysUntilExpiry <= 30) {
      expiryStatus = 'expiring_soon'
    } else {
      expiryStatus = 'valid'
    }
  }

  return {
    ...updatedDocument,
    expiryStatus,
    daysUntilExpiry: updatedDocument.expiryDate
      ? Math.ceil((updatedDocument.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }
})
