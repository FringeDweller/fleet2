import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

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

  // Get uploaded chunk indices for resume capability
  const uploadedChunks = await db.query.uploadChunks.findMany({
    where: eq(schema.uploadChunks.sessionId, sessionId),
    columns: {
      chunkIndex: true,
      size: true,
      checksum: true,
    },
    orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)],
  })

  // Calculate progress
  const progress = (session.uploadedChunks / session.totalChunks) * 100
  const uploadedBytes = uploadedChunks.reduce((sum, chunk) => sum + chunk.size, 0)

  // Check if session has expired
  const isExpired = session.expiresAt < new Date()

  // Determine missing chunks for resume
  const uploadedIndices = new Set(uploadedChunks.map((c) => c.chunkIndex))
  const missingChunks: number[] = []
  for (let i = 0; i < session.totalChunks; i++) {
    if (!uploadedIndices.has(i)) {
      missingChunks.push(i)
    }
  }

  return {
    sessionId: session.id,
    filename: session.filename,
    mimeType: session.mimeType,
    totalSize: session.totalSize,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    uploadedChunks: session.uploadedChunks,
    uploadedBytes,
    progress: Math.round(progress * 100) / 100,
    status: isExpired && session.status !== 'completed' ? 'expired' : session.status,
    isExpired,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    // For resume capability
    missingChunks,
    canResume: !isExpired && session.status !== 'completed' && session.status !== 'failed',
    // Detailed chunk info for verification
    chunks: uploadedChunks.map((chunk) => ({
      index: chunk.chunkIndex,
      size: chunk.size,
      checksum: chunk.checksum,
    })),
  }
})
