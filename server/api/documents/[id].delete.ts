import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * DELETE /api/documents/[id] - Delete a document
 * Removes the document and all associated versions and links
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

  // Verify document exists and belongs to org
  const document = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, id),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
    with: {
      folder: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Delete document links first (due to foreign key)
  await db.delete(schema.documentLinks).where(eq(schema.documentLinks.documentId, id))

  // Delete document versions (due to foreign key)
  await db.delete(schema.documentVersions).where(eq(schema.documentVersions.documentId, id))

  // Delete the document
  await db.delete(schema.documents).where(eq(schema.documents.id, id))

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'document',
    entityId: id,
    oldValues: {
      name: document.name,
      originalFilename: document.originalFilename,
      category: document.category,
      folderId: document.folderId,
      folderName: document.folder?.name || null,
      filePath: document.filePath,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
