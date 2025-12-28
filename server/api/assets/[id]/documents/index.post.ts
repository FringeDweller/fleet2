import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  filePath: z.string().min(1).max(500),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  description: z.string().max(1000).optional().nullable(),
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
    .default('other'),
  expiryDate: z.string().datetime().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  const body = await readBody(event)
  const result = createDocumentSchema.safeParse(body)

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
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const [document] = await db
    .insert(schema.assetDocuments)
    .values({
      assetId,
      name: result.data.name,
      filePath: result.data.filePath,
      fileType: result.data.fileType,
      fileSize: result.data.fileSize,
      description: result.data.description,
      documentType: result.data.documentType,
      expiryDate: result.data.expiryDate ? new Date(result.data.expiryDate) : null,
      uploadedById: session.user.id,
    })
    .returning()

  if (!document) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload document',
    })
  }

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document.uploaded',
    entityType: 'asset_document',
    entityId: document.id,
    newValues: {
      assetId,
      assetNumber: asset.assetNumber,
      name: document.name,
      documentType: document.documentType,
      fileSize: document.fileSize,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return document
})
