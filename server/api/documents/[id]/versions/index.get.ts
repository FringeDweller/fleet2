import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/permissions'

/**
 * GET /api/documents/[id]/versions
 * List all versions of a document, ordered by version number descending (newest first)
 *
 * Returns version history including:
 * - Version number
 * - Created date
 * - File size
 * - Created by user
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

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
      eq(schema.documents.organisationId, user.organisationId),
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

  // Get all versions with uploader info, ordered by version number (newest first)
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
    orderBy: [desc(schema.documentVersions.versionNumber)],
  })

  // Mark which version is current and format response
  const versionsWithCurrent = versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    fileSize: version.fileSize,
    mimeType: version.mimeType,
    changeNotes: version.changeNotes,
    createdAt: version.createdAt,
    createdBy: version.uploadedBy,
    isCurrent: version.id === document.currentVersionId,
  }))

  return {
    documentId: document.id,
    documentName: document.name,
    versions: versionsWithCurrent,
    count: versions.length,
  }
})
