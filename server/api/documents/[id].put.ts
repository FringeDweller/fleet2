import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z
    .enum([
      'registration',
      'insurance',
      'inspection',
      'certification',
      'manual',
      'warranty',
      'invoice',
      'contract',
      'report',
      'other',
    ])
    .optional(),
  tags: z.array(z.string()).optional().nullable(),
  expiryDate: z.string().datetime().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
})

/**
 * PUT /api/documents/[id] - Update document metadata
 * Supports renaming, updating category/tags, changing expiry, and moving to folder
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
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

  // Verify document exists and belongs to org
  const existing = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, id),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // If moving to a folder, verify the folder exists and belongs to org
  if (result.data.folderId !== undefined && result.data.folderId !== null) {
    const folder = await db.query.documentFolders.findFirst({
      where: and(
        eq(schema.documentFolders.id, result.data.folderId),
        eq(schema.documentFolders.organisationId, session.user.organisationId),
      ),
    })

    if (!folder) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target folder not found',
      })
    }
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
  if (result.data.category !== undefined) {
    updateData.category = result.data.category
  }
  if (result.data.tags !== undefined) {
    updateData.tags = result.data.tags
  }
  if (result.data.expiryDate !== undefined) {
    updateData.expiryDate = result.data.expiryDate ? new Date(result.data.expiryDate) : null
  }
  if (result.data.folderId !== undefined) {
    updateData.folderId = result.data.folderId
  }

  // Store old values for audit
  const oldValues = {
    name: existing.name,
    description: existing.description,
    category: existing.category,
    tags: existing.tags,
    expiryDate: existing.expiryDate?.toISOString() || null,
    folderId: existing.folderId,
  }

  // Update document
  const [updated] = await db
    .update(schema.documents)
    .set(updateData)
    .where(eq(schema.documents.id, id))
    .returning()

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'document',
    entityId: id,
    oldValues,
    newValues: result.data,
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  // Calculate expiry status for response
  let expiryStatus: 'expired' | 'expiring_soon' | 'valid' | null = null
  let daysUntilExpiry: number | null = null

  if (updated!.expiryDate) {
    const now = new Date()
    daysUntilExpiry = Math.ceil(
      (updated!.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
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
    ...updated,
    expiryStatus,
    daysUntilExpiry,
  }
})
