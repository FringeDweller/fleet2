import { eq } from 'drizzle-orm'
import { db, schema } from './db'

// Firebase Cloud Messaging configuration
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID
const FCM_PRIVATE_KEY = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL

// FCM API endpoint
const FCM_API_URL = FCM_PROJECT_ID
  ? `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`
  : null

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  icon?: string
  imageUrl?: string
  clickAction?: string
}

export interface SendNotificationResult {
  success: boolean
  messageId?: string
  error?: string
  token: string
}

/**
 * Get OAuth2 access token for FCM API
 * Uses service account credentials to generate a short-lived access token
 */
async function getAccessToken(): Promise<string> {
  if (!FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    throw new Error('FCM credentials not configured')
  }

  // Create JWT header and claims
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: FCM_CLIENT_EMAIL,
    sub: FCM_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour expiry
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }

  // Base64url encode header and claims
  const base64UrlEncode = (obj: object) => {
    const json = JSON.stringify(obj)
    const base64 = Buffer.from(json).toString('base64')
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerEncoded = base64UrlEncode(header)
  const claimsEncoded = base64UrlEncode(claims)
  const signatureInput = `${headerEncoded}.${claimsEncoded}`

  // Sign with RS256
  const crypto = await import('node:crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signatureInput)
  const signature = sign.sign(FCM_PRIVATE_KEY, 'base64')
  const signatureEncoded = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${signatureInput}.${signatureEncoded}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get FCM access token: ${error}`)
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string }
  return tokenData.access_token
}

/**
 * Send a push notification to a single device token
 *
 * @param deviceToken - The FCM device token to send to
 * @param payload - The notification payload
 * @returns Result of the send operation
 */
export async function sendPushNotification(
  deviceToken: string,
  payload: PushNotificationPayload,
): Promise<SendNotificationResult> {
  if (!FCM_API_URL) {
    console.warn('[PushNotifications] FCM not configured, skipping notification')
    return {
      success: false,
      error: 'FCM not configured',
      token: deviceToken,
    }
  }

  try {
    const accessToken = await getAccessToken()

    const message: {
      token: string
      notification: {
        title: string
        body: string
        image?: string
      }
      data?: Record<string, string>
      android?: {
        notification: {
          icon?: string
          click_action?: string
        }
      }
      webpush?: {
        notification: {
          icon?: string
        }
        fcm_options: {
          link?: string
        }
      }
      apns?: {
        payload: {
          aps: {
            'mutable-content': number
          }
        }
        fcm_options: {
          image?: string
        }
      }
    } = {
      token: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
    }

    // Add optional image
    if (payload.imageUrl) {
      message.notification.image = payload.imageUrl
    }

    // Add custom data payload
    if (payload.data && Object.keys(payload.data).length > 0) {
      message.data = payload.data
    }

    // Android-specific options
    if (payload.icon || payload.clickAction) {
      message.android = {
        notification: {
          ...(payload.icon && { icon: payload.icon }),
          ...(payload.clickAction && { click_action: payload.clickAction }),
        },
      }
    }

    // Web push options
    if (payload.icon || payload.clickAction) {
      message.webpush = {
        notification: {
          ...(payload.icon && { icon: payload.icon }),
        },
        fcm_options: {
          ...(payload.clickAction && { link: payload.clickAction }),
        },
      }
    }

    // iOS options
    if (payload.imageUrl) {
      message.apns = {
        payload: {
          aps: {
            'mutable-content': 1,
          },
        },
        fcm_options: {
          image: payload.imageUrl,
        },
      }
    }

    const response = await fetch(FCM_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: { message?: string; code?: number } }
      const errorMessage = errorData.error?.message || response.statusText

      // Handle specific error codes
      if (response.status === 404 || errorData.error?.code === 404) {
        console.warn(`[PushNotifications] Invalid token: ${deviceToken}`)
        // Mark token as invalid in database
        await handleInvalidToken(deviceToken)
        return {
          success: false,
          error: 'Invalid device token',
          token: deviceToken,
        }
      }

      console.error(`[PushNotifications] FCM error: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage,
        token: deviceToken,
      }
    }

    const result = (await response.json()) as { name: string }
    console.log(`[PushNotifications] Sent to ${deviceToken.substring(0, 20)}...`)

    return {
      success: true,
      messageId: result.name,
      token: deviceToken,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[PushNotifications] Error sending to ${deviceToken}: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
      token: deviceToken,
    }
  }
}

/**
 * Send push notifications to multiple device tokens
 *
 * @param deviceTokens - Array of FCM device tokens
 * @param payload - The notification payload
 * @returns Array of results for each token
 */
export async function sendPushNotificationToMany(
  deviceTokens: string[],
  payload: PushNotificationPayload,
): Promise<SendNotificationResult[]> {
  if (deviceTokens.length === 0) {
    return []
  }

  console.log(`[PushNotifications] Sending to ${deviceTokens.length} devices`)

  // Send to all tokens concurrently
  const results = await Promise.all(
    deviceTokens.map((token) => sendPushNotification(token, payload)),
  )

  // Log summary
  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length
  console.log(`[PushNotifications] Sent: ${successCount} success, ${failureCount} failed`)

  return results
}

/**
 * Send push notifications to all devices registered for a user
 *
 * @param userId - The user ID to send notifications to
 * @param payload - The notification payload
 * @returns Array of results for each device
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload,
): Promise<SendNotificationResult[]> {
  // Get all push tokens for the user
  const tokens = await db.query.pushTokens.findMany({
    where: eq(schema.pushTokens.userId, userId),
  })

  if (tokens.length === 0) {
    console.log(`[PushNotifications] No push tokens found for user ${userId}`)
    return []
  }

  console.log(`[PushNotifications] Found ${tokens.length} device(s) for user ${userId}`)

  const deviceTokens = tokens.map((t) => t.deviceToken)
  const results = await sendPushNotificationToMany(deviceTokens, payload)

  // Update lastUsedAt for successful tokens
  const successfulTokens = results.filter((r) => r.success).map((r) => r.token)
  if (successfulTokens.length > 0) {
    await Promise.all(
      successfulTokens.map((token) =>
        db
          .update(schema.pushTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(schema.pushTokens.deviceToken, token)),
      ),
    )
  }

  return results
}

/**
 * Send push notifications to all devices for multiple users
 *
 * @param userIds - Array of user IDs
 * @param payload - The notification payload
 * @returns Map of userId to results
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
): Promise<Map<string, SendNotificationResult[]>> {
  const results = new Map<string, SendNotificationResult[]>()

  // Send to all users concurrently
  await Promise.all(
    userIds.map(async (userId) => {
      const userResults = await sendPushNotificationToUser(userId, payload)
      results.set(userId, userResults)
    }),
  )

  return results
}

/**
 * Handle an invalid FCM token by removing it from the database
 */
async function handleInvalidToken(deviceToken: string): Promise<void> {
  try {
    await db.delete(schema.pushTokens).where(eq(schema.pushTokens.deviceToken, deviceToken))
    console.log(`[PushNotifications] Removed invalid token: ${deviceToken.substring(0, 20)}...`)
  } catch (error) {
    console.error('[PushNotifications] Failed to remove invalid token:', error)
  }
}

/**
 * Check if FCM is configured and available
 */
export function isPushNotificationsEnabled(): boolean {
  return !!(FCM_PROJECT_ID && FCM_PRIVATE_KEY && FCM_CLIENT_EMAIL)
}
