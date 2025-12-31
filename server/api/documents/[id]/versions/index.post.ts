import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const createVersionSchema = z.object({
  filePath: z.string().min(1).max(500),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  changeNotes: z.string().max(1000).optional().nullable(),
  // Optional: true for major version bump (x.0), false/undefined for minor (x.y)
  isMajorVersion: z.boolean().optional().default(false),
})

/**
 * POST /api/documents/[id]/versions
 * Upload a new version of a document
 *
 * Version numbering:
 * - Minor version (default): 1.0 -> 1.1 -> 1.2
 * - Major version (isMajorVersion: true): 1.2 -> 2.0
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

  const body = await readBody(event)
  const result = createVersionSchema.safeParse(body)

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

  // Get the latest version to calculate next version number
  const latestVersion = await db.query.documentVersions.findFirst({
    where: eq(schema.documentVersions.documentId, documentId),
    orderBy: [desc(schema.documentVersions.createdAt)],
    columns: {
      versionNumber: true,
    },
  })

  // Calculate next version number
  let nextVersionNumber: string
  if (!latestVersion) {
    // First version
    nextVersionNumber = '1.0'
  } else {
    const parts = latestVersion.versionNumber.split('.').map(Number)
    const major = parts[0] ?? 1
    const minor = parts[1] ?? 0
    if (result.data.isMajorVersion) {
      // Major version bump: 1.2 -> 2.0
      nextVersionNumber = `${major + 1}.0`
    } else {
      // Minor version bump: 1.0 -> 1.1
      nextVersionNumber = `${major}.${minor + 1}`
    }
  }

  // Create new version and update document's currentVersionId in transaction
  const [newVersion] = await db.transaction(async (tx) => {
    // Insert new version
    const [version] = await tx
      .insert(schema.documentVersions)
      .values({
        documentId,
        versionNumber: nextVersionNumber,
        filePath: result.data.filePath,
        fileSize: result.data.fileSize,
        mimeType: result.data.mimeType,
        changeNotes: result.data.changeNotes,
        uploadedById: session.user!.id,
      })
      .returning()

    if (!version) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create version',
      })
    }

    // Update document with new current version and file info
    await tx
      .update(schema.documents)
      .set({
        currentVersionId: version.id,
        filePath: result.data.filePath,
        fileSize: result.data.fileSize,
        mimeType: result.data.mimeType,
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId))

    return [version]
  })

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document.version.created',
    entityType: 'document_version',
    entityId: newVersion.id,
    newValues: {
      documentId,
      documentName: document.name,
      versionNumber: nextVersionNumber,
      fileSize: result.data.fileSize,
      mimeType: result.data.mimeType,
      isMajorVersion: result.data.isMajorVersion,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return {
    ...newVersion,
    isCurrent: true,
  }
})
