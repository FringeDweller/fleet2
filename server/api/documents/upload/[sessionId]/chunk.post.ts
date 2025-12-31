import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/permissions'

// Get uploads directory from environment or use default
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'data/uploads'
const TEMP_DIR = join(UPLOADS_DIR, 'temp')

const chunkUploadSchema = z.object({
  chunkIndex: z.number().int().min(0),
  data: z.string().min(1), // Base64 encoded chunk data
  checksum: z.string().length(64).optional(), // SHA-256 checksum for integrity verification
})

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
  const result = chunkUploadSchema.safeParse(body)

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

  // Check if session is in a valid state for uploading
  if (session.status === 'completed') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Upload session has already been completed',
    })
  }

  if (session.status === 'failed') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Upload session has failed',
    })
  }

  // Validate chunk index
  if (data.chunkIndex >= session.totalChunks) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid chunk index. Maximum is ${session.totalChunks - 1}`,
    })
  }

  // Check if this chunk was already uploaded
  const existingChunk = await db.query.uploadChunks.findFirst({
    where: and(
      eq(schema.uploadChunks.sessionId, sessionId),
      eq(schema.uploadChunks.chunkIndex, data.chunkIndex),
    ),
    columns: { id: true },
  })

  if (existingChunk) {
    throw createError({
      statusCode: 409,
      statusMessage: `Chunk ${data.chunkIndex} has already been uploaded`,
    })
  }

  // Decode base64 data
  let chunkData: Buffer
  try {
    chunkData = Buffer.from(data.data, 'base64')
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid base64 encoded data',
    })
  }

  // Validate chunk size
  const isLastChunk = data.chunkIndex === session.totalChunks - 1
  const expectedSize = isLastChunk
    ? session.totalSize - session.chunkSize * (session.totalChunks - 1)
    : session.chunkSize

  // Allow some tolerance for the last chunk
  if (!isLastChunk && chunkData.length !== session.chunkSize) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid chunk size. Expected ${session.chunkSize} bytes, got ${chunkData.length}`,
    })
  }

  if (isLastChunk && chunkData.length !== expectedSize) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid last chunk size. Expected ${expectedSize} bytes, got ${chunkData.length}`,
    })
  }

  // Verify checksum if provided
  const computedChecksum = createHash('sha256').update(chunkData).digest('hex')
  if (data.checksum && data.checksum !== computedChecksum) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Checksum mismatch. Data may be corrupted',
    })
  }

  // Ensure temp directory exists for this session
  const sessionTempDir = join(TEMP_DIR, session.id)
  await mkdir(sessionTempDir, { recursive: true })

  // Write chunk to temp file
  const chunkPath = join(sessionTempDir, `chunk_${data.chunkIndex.toString().padStart(5, '0')}`)
  await writeFile(chunkPath, chunkData)

  // Record the chunk in database
  const [chunk] = await db
    .insert(schema.uploadChunks)
    .values({
      sessionId,
      chunkIndex: data.chunkIndex,
      size: chunkData.length,
      checksum: computedChecksum,
      tempPath: chunkPath,
    })
    .returning()

  if (!chunk) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to record chunk',
    })
  }

  // Update session with incremented chunk count and status
  const [updatedSession] = await db
    .update(schema.uploadSessions)
    .set({
      uploadedChunks: sql`${schema.uploadSessions.uploadedChunks} + 1`,
      status: 'in_progress',
      tempPath: sessionTempDir,
      updatedAt: new Date(),
    })
    .where(eq(schema.uploadSessions.id, sessionId))
    .returning()

  // Calculate progress
  const progress =
    ((updatedSession?.uploadedChunks ?? session.uploadedChunks + 1) / session.totalChunks) * 100

  return {
    chunkIndex: data.chunkIndex,
    size: chunkData.length,
    checksum: computedChecksum,
    uploadedChunks: updatedSession?.uploadedChunks ?? session.uploadedChunks + 1,
    totalChunks: session.totalChunks,
    progress: Math.round(progress * 100) / 100, // Round to 2 decimal places
    status: updatedSession?.status ?? 'in_progress',
    isComplete:
      (updatedSession?.uploadedChunks ?? session.uploadedChunks + 1) === session.totalChunks,
  }
})
