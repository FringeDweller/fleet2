import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../../utils/db'

/**
 * GET /api/documents/[id]/versions/[versionId]
 * Get a specific version of a document
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
  const versionId = getRouterParam(event, 'versionId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  if (!versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version ID is required',
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

  // Get the specific version
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(schema.documentVersions.id, versionId),
      eq(schema.documentVersions.documentId, documentId),
    ),
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
  })

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Version not found',
    })
  }

  return {
    ...version,
    documentName: document.name,
    isCurrent: version.id === document.currentVersionId,
  }
})
