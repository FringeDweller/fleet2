import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

const unregisterPushTokenSchema = z.object({
  deviceToken: z.string().min(1, 'Device token is required').max(500, 'Device token too long'),
})

/**
 * Unregister a device token for push notifications
 * POST /api/notifications/unregister
 * Requires authentication
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = unregisterPushTokenSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { deviceToken } = result.data

  // Find and delete the token
  const existingToken = await db.query.pushTokens.findFirst({
    where: and(
      eq(schema.pushTokens.userId, user.id),
      eq(schema.pushTokens.deviceToken, deviceToken),
    ),
  })

  if (!existingToken) {
    // Token not found, but return success anyway (idempotent)
    return {
      success: true,
      message: 'Device token not found or already removed',
    }
  }

  // Delete the token
  await db.delete(schema.pushTokens).where(eq(schema.pushTokens.id, existingToken.id))

  console.log(
    `[PushNotifications] Unregistered token for user ${user.id}, platform: ${existingToken.platform}`,
  )

  // Log in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'push_token',
    entityId: existingToken.id,
    oldValues: {
      platform: existingToken.platform,
      deviceId: existingToken.deviceId || null,
    },
    newValues: null,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: 'Device token unregistered',
  }
})
