import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const moveDocumentSchema = z.object({
  folderId: z.string().uuid().nullable(),
})

/**
 * POST /api/documents/[id]/move - Move document to a different folder
 * Set folderId to null to move to root (no folder)
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
  const result = moveDocumentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
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

  // If target folder is specified, verify it exists
  let targetFolder = null
  if (result.data.folderId) {
    targetFolder = await db.query.documentFolders.findFirst({
      where: and(
        eq(schema.documentFolders.id, result.data.folderId),
        eq(schema.documentFolders.organisationId, session.user.organisationId),
      ),
    })

    if (!targetFolder) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target folder not found',
      })
    }
  }

  // Check if already in the target folder
  if (document.folderId === result.data.folderId) {
    return {
      success: true,
      message: 'Document is already in the target folder',
      document,
    }
  }

  // Update document folder
  const [updated] = await db
    .update(schema.documents)
    .set({
      folderId: result.data.folderId,
      updatedAt: new Date(),
    })
    .where(eq(schema.documents.id, id))
    .returning()

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'move',
    entityType: 'document',
    entityId: id,
    oldValues: {
      folderId: document.folderId,
      folderName: document.folder?.name || null,
    },
    newValues: {
      folderId: result.data.folderId,
      folderName: targetFolder?.name || null,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return {
    success: true,
    document: updated,
  }
})
