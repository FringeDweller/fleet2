import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/permissions'

// Get uploads directory from environment or use default
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'data/uploads'
const DOCUMENTS_DIR = join(UPLOADS_DIR, 'documents')

const completeUploadSchema = z.object({
  // Optional metadata to override what was set at start
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
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
  tags: z.array(z.string().max(50)).max(10).optional(),
  expiryDate: z.string().datetime().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
  // Full file checksum for final verification
  checksum: z.string().length(64).optional(),
})

async function assembleChunks(
  chunks: Array<{ chunkIndex: number; tempPath: string }>,
  outputPath: string,
): Promise<{ size: number; checksum: string }> {
  // Ensure output directory exists
  const outputDir = join(outputPath, '..')
  await mkdir(outputDir, { recursive: true })

  // Sort chunks by index
  const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex)

  // Create output stream
  const outputStream = createWriteStream(outputPath)
  const hash = createHash('sha256')
  let totalSize = 0

  // Write chunks in order
  for (const chunk of sortedChunks) {
    const chunkData = await readFile(chunk.tempPath)
    outputStream.write(chunkData)
    hash.update(chunkData)
    totalSize += chunkData.length
  }

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    outputStream.on('finish', resolve)
    outputStream.on('error', reject)
    outputStream.end()
  })

  return {
    size: totalSize,
    checksum: hash.digest('hex'),
  }
}

async function cleanupTempFiles(sessionTempDir: string): Promise<void> {
  try {
    await rm(sessionTempDir, { recursive: true, force: true })
  } catch (error) {
    console.error(`Failed to cleanup temp directory: ${sessionTempDir}`, error)
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

  const body = await readBody(event)
  const result = completeUploadSchema.safeParse(body || {})

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Find the upload session
  const session = await db.query.uploadSessions.findFirst({
    where: and(
      eq(schema.uploadSessions.id, sessionId),
      eq(schema.uploadSessions.organisationId, user.organisationId),
      eq(schema.uploadSessions.userId, user.id),
    ),
  })

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Upload session not found',
    })
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Upload session has expired',
    })
  }

  // Check if session is already completed
  if (session.status === 'completed') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Upload session has already been completed',
    })
  }

  // Check if all chunks have been uploaded
  if (session.uploadedChunks !== session.totalChunks) {
    throw createError({
      statusCode: 400,
      statusMessage: `Upload incomplete. Uploaded ${session.uploadedChunks}/${session.totalChunks} chunks`,
      data: {
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        missingChunks: session.totalChunks - session.uploadedChunks,
      },
    })
  }

  // Validate folder if provided
  if (data.folderId) {
    const folder = await db.query.documentFolders.findFirst({
      where: (documentFolders, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(documentFolders.id, data.folderId!),
          eqOp(documentFolders.organisationId, user.organisationId),
        ),
      columns: { id: true },
    })

    if (!folder) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found',
      })
    }
  }

  // Get all chunks for this session
  const chunks = await db.query.uploadChunks.findMany({
    where: eq(schema.uploadChunks.sessionId, sessionId),
    orderBy: asc(schema.uploadChunks.chunkIndex),
  })

  if (chunks.length !== session.totalChunks) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Chunk count mismatch in database',
    })
  }

  // Generate file path
  const fileExtension = extname(session.filename) || ''
  const now = new Date()
  const dateFolder = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`
  const uniqueFilename = `${crypto.randomUUID()}${fileExtension}`
  const relativePath = join(dateFolder, uniqueFilename)
  const absolutePath = join(DOCUMENTS_DIR, relativePath)

  try {
    // Assemble chunks into final file
    const { size, checksum } = await assembleChunks(
      chunks.map((c) => ({ chunkIndex: c.chunkIndex, tempPath: c.tempPath })),
      absolutePath,
    )

    // Verify size matches
    if (size !== session.totalSize) {
      await unlink(absolutePath).catch(() => {})
      throw createError({
        statusCode: 500,
        statusMessage: `File size mismatch. Expected ${session.totalSize}, got ${size}`,
      })
    }

    // Verify checksum if provided
    if (data.checksum && data.checksum !== checksum) {
      await unlink(absolutePath).catch(() => {})
      throw createError({
        statusCode: 400,
        statusMessage: 'File checksum mismatch. Upload may be corrupted',
      })
    }

    // Document metadata
    const documentName = data.name || session.filename
    const category = data.category || 'other'
    const tags = data.tags || null

    // Create document and version in a transaction
    const [document, version] = await db.transaction(async (tx) => {
      // Create the document
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          organisationId: user.organisationId,
          folderId: data.folderId || null,
          name: documentName,
          originalFilename: session.filename,
          filePath: relativePath,
          mimeType: session.mimeType,
          fileSize: size,
          description: data.description || null,
          category,
          tags,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          uploadedById: user.id,
        })
        .returning()

      if (!doc) {
        throw new Error('Failed to create document')
      }

      // Create the first version
      const [ver] = await tx
        .insert(schema.documentVersions)
        .values({
          documentId: doc.id,
          versionNumber: '1.0',
          filePath: relativePath,
          fileSize: size,
          mimeType: session.mimeType,
          changeNotes: 'Initial upload',
          uploadedById: user.id,
        })
        .returning()

      if (!ver) {
        throw new Error('Failed to create document version')
      }

      // Update document with current version
      await tx
        .update(schema.documents)
        .set({
          currentVersionId: ver.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.documents.id, doc.id))

      // Update search vector using raw SQL
      // Convert tags array to a space-separated string for full-text search
      const tagsString = tags && tags.length > 0 ? tags.join(' ') : ''
      await tx.execute(sql`
        UPDATE documents
        SET search_vector =
          setweight(to_tsvector('english', coalesce(${documentName}, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(${data.description || ''}, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(${tagsString}, '')), 'C')
        WHERE id = ${doc.id}
      `)

      // Mark session as completed
      await tx
        .update(schema.uploadSessions)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(schema.uploadSessions.id, sessionId))

      // Delete chunk records
      await tx.delete(schema.uploadChunks).where(eq(schema.uploadChunks.sessionId, sessionId))

      return [doc, ver]
    })

    // Cleanup temp files (async, don't wait)
    if (session.tempPath) {
      cleanupTempFiles(session.tempPath)
    }

    // Log the upload completion
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: document.id,
      newValues: {
        name: document.name,
        filename: document.originalFilename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        category: document.category,
        versionId: version.id,
      },
      ipAddress: getRequestIP(event),
      userAgent: getHeader(event, 'user-agent'),
    })

    return {
      document: {
        id: document.id,
        name: document.name,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        description: document.description,
        category: document.category,
        tags: document.tags,
        folderId: document.folderId,
        expiryDate: document.expiryDate?.toISOString() || null,
        currentVersionId: version.id,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        fileSize: version.fileSize,
        mimeType: version.mimeType,
        changeNotes: version.changeNotes,
        createdAt: version.createdAt.toISOString(),
      },
      upload: {
        sessionId,
        checksum,
        status: 'completed',
      },
    }
  } catch (error) {
    // Mark session as failed on error
    await db
      .update(schema.uploadSessions)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(schema.uploadSessions.id, sessionId))

    // Cleanup temp files on error
    if (session.tempPath) {
      cleanupTempFiles(session.tempPath)
    }

    throw error
  }
})
