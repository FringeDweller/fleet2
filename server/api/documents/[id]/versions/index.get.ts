import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

/**
 * GET /api/documents/[id]/versions
 * List all versions of a document, ordered by creation date (newest first)
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  // Verify document exists and belongs to user's organisation
  const document = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, documentId),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
    columns: {
      id: true,
      name: true,
      currentVersionId: true,
    },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Get all versions with uploader info
  const versions = await db.query.documentVersions.findMany({
    where: eq(schema.documentVersions.documentId, documentId),
    with: {
      uploadedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: [desc(schema.documentVersions.createdAt)],
  })

  // Mark which version is current
  const versionsWithCurrent = versions.map((version) => ({
    ...version,
    isCurrent: version.id === document.currentVersionId,
  }))

  return {
    documentId: document.id,
    documentName: document.name,
    versions: versionsWithCurrent,
    count: versions.length,
  }
})
