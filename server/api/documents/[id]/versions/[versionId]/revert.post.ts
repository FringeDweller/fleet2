import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../../utils/db'

const revertSchema = z.object({
  changeNotes: z.string().max(1000).optional().nullable(),
})

/**
 * POST /api/documents/[id]/versions/[versionId]/revert
 * Revert document to a previous version
 *
 * This creates a NEW version (copy of the old version) rather than
 * simply changing the currentVersionId, ensuring full version history
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

  const body = await readBody(event)
  const result = revertSchema.safeParse(body || {})

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
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

  // Get the version to revert to
  const targetVersion = await db.query.documentVersions.findFirst({
    where: and(
      eq(schema.documentVersions.id, versionId),
      eq(schema.documentVersions.documentId, documentId),
    ),
  })

  if (!targetVersion) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Version not found',
    })
  }

  // Check if already current version
  if (document.currentVersionId === versionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot revert to the current version',
    })
  }

  // Get the latest version to calculate next version number
  const latestVersion = await db.query.documentVersions.findFirst({
    where: eq(schema.documentVersions.documentId, documentId),
    orderBy: [desc(schema.documentVersions.createdAt)],
    columns: {
      versionNumber: true,
    },
  })

  // Calculate next version number (always minor bump for reverts)
  let nextVersionNumber: string
  if (!latestVersion) {
    nextVersionNumber = '1.0'
  } else {
    const parts = latestVersion.versionNumber.split('.').map(Number)
    const major = parts[0] ?? 1
    const minor = parts[1] ?? 0
    nextVersionNumber = `${major}.${minor + 1}`
  }

  // Default change notes if not provided
  const changeNotes =
    result.data.changeNotes || `Reverted to version ${targetVersion.versionNumber}`

  // Create new version as copy of target version and update document in transaction
  const [newVersion] = await db.transaction(async (tx) => {
    // Create new version with same file but new version number
    const [version] = await tx
      .insert(schema.documentVersions)
      .values({
        documentId,
        versionNumber: nextVersionNumber,
        filePath: targetVersion.filePath,
        fileSize: targetVersion.fileSize,
        mimeType: targetVersion.mimeType,
        changeNotes,
        uploadedById: session.user!.id,
      })
      .returning()

    if (!version) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create reverted version',
      })
    }

    // Update document with new current version
    await tx
      .update(schema.documents)
      .set({
        currentVersionId: version.id,
        filePath: targetVersion.filePath,
        fileSize: targetVersion.fileSize,
        mimeType: targetVersion.mimeType,
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId))

    return [version]
  })

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document.version.reverted',
    entityType: 'document_version',
    entityId: newVersion.id,
    oldValues: {
      previousVersionId: document.currentVersionId,
    },
    newValues: {
      documentId,
      documentName: document.name,
      newVersionNumber: nextVersionNumber,
      revertedFromVersionId: versionId,
      revertedFromVersionNumber: targetVersion.versionNumber,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return {
    ...newVersion,
    isCurrent: true,
    revertedFromVersion: {
      id: targetVersion.id,
      versionNumber: targetVersion.versionNumber,
    },
  }
})
