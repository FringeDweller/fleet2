import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!assetId || !docId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID and Document ID are required',
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

  // Get document before deletion for audit log
  const document = await db.query.assetDocuments.findFirst({
    where: and(eq(schema.assetDocuments.id, docId), eq(schema.assetDocuments.assetId, assetId)),
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Delete document
  await db.delete(schema.assetDocuments).where(eq(schema.assetDocuments.id, docId))

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document.deleted',
    entityType: 'asset_document',
    entityId: document.id,
    oldValues: {
      assetId,
      assetNumber: asset.assetNumber,
      name: document.name,
      documentType: document.documentType,
      filePath: document.filePath,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
