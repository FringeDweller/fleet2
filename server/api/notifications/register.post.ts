import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

const registerPushTokenSchema = z.object({
  deviceToken: z.string().min(1, 'Device token is required').max(500, 'Device token too long'),
  platform: z.enum(['ios', 'android', 'web'], {
    message: 'Platform must be ios, android, or web',
  }),
  deviceId: z.string().max(255).optional(),
  deviceInfo: z
    .object({
      model: z.string().optional(),
      osVersion: z.string().optional(),
      appVersion: z.string().optional(),
      manufacturer: z.string().optional(),
    })
    .optional(),
})

/**
 * Register a device token for push notifications
 * POST /api/notifications/register
 * Requires authentication
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = registerPushTokenSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { deviceToken, platform, deviceId, deviceInfo } = result.data

  // Check if this device token already exists for this user
  const existingToken = await db.query.pushTokens.findFirst({
    where: and(
      eq(schema.pushTokens.userId, user.id),
      eq(schema.pushTokens.deviceToken, deviceToken),
    ),
  })

  if (existingToken) {
    // Update existing token
    const [updatedToken] = await db
      .update(schema.pushTokens)
      .set({
        platform,
        deviceId: deviceId || null,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.pushTokens.id, existingToken.id))
      .returning()

    console.log(`[PushNotifications] Updated token for user ${user.id}, platform: ${platform}`)

    return {
      success: true,
      message: 'Device token updated',
      tokenId: updatedToken?.id,
    }
  }

  // If deviceId is provided, check if we need to replace an existing token for this device
  if (deviceId) {
    const existingDeviceToken = await db.query.pushTokens.findFirst({
      where: and(eq(schema.pushTokens.userId, user.id), eq(schema.pushTokens.deviceId, deviceId)),
    })

    if (existingDeviceToken) {
      // Replace the token for this device
      const [updatedToken] = await db
        .update(schema.pushTokens)
        .set({
          deviceToken,
          platform,
          deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.pushTokens.id, existingDeviceToken.id))
        .returning()

      console.log(`[PushNotifications] Replaced token for device ${deviceId}, user ${user.id}`)

      return {
        success: true,
        message: 'Device token replaced',
        tokenId: updatedToken?.id,
      }
    }
  }

  // Create new push token
  const [newToken] = await db
    .insert(schema.pushTokens)
    .values({
      organisationId: user.organisationId,
      userId: user.id,
      deviceToken,
      platform,
      deviceId: deviceId || null,
      deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
    })
    .returning()

  if (!newToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to register device token',
    })
  }

  console.log(`[PushNotifications] Registered new token for user ${user.id}, platform: ${platform}`)

  // Log in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'push_token',
    entityId: newToken.id,
    oldValues: null,
    newValues: {
      platform,
      deviceId: deviceId || null,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: 'Device token registered',
    tokenId: newToken.id,
  }
})
