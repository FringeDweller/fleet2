import { rm } from 'node:fs/promises'
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

  // Cannot cancel a completed upload
  if (session.status === 'completed') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot cancel a completed upload',
    })
  }

  // Delete chunk records
  await db.delete(schema.uploadChunks).where(eq(schema.uploadChunks.sessionId, sessionId))

  // Delete session record
  await db.delete(schema.uploadSessions).where(eq(schema.uploadSessions.id, sessionId))

  // Cleanup temp files
  if (session.tempPath) {
    try {
      await rm(session.tempPath, { recursive: true, force: true })
    } catch (error) {
      console.error(`Failed to cleanup temp directory: ${session.tempPath}`, error)
    }
  }

  // Log the cancellation
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'upload_session.cancelled',
    entityType: 'upload_session',
    entityId: sessionId,
    newValues: {
      filename: session.filename,
      uploadedChunks: session.uploadedChunks,
      totalChunks: session.totalChunks,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return {
    success: true,
    sessionId,
    message: 'Upload session cancelled and cleaned up',
  }
})
