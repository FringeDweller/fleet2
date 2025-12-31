import { z } from 'zod'
import {
  authenticateUser,
  checkBruteForce,
  recordFailedAttempt,
  resetBruteForce,
} from '../../utils/auth'

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * Get client IP address from the request
 * Considers proxy headers for accurate IP detection
 */
function getClientIp(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
): string {
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  const realIp = getHeader(event, 'x-real-ip')
  const socketAddress = getRequestIP(event)

  // Use the first IP in x-forwarded-for, or x-real-ip, or socket address
  return forwardedFor?.split(',')[0]?.trim() || realIp || socketAddress || 'unknown'
}

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event)

  // Check for brute force blocking (IP-based)
  const bruteForceCheck = checkBruteForce(clientIp)
  if (bruteForceCheck.blocked) {
    // Set Retry-After header
    if (bruteForceCheck.remainingMs) {
      const retryAfterSeconds = Math.ceil(bruteForceCheck.remainingMs / 1000)
      setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    }

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: bruteForceCheck.message || 'Too many login attempts. Please try again later.',
      data: {
        retryAfter: bruteForceCheck.remainingMs
          ? Math.ceil(bruteForceCheck.remainingMs / 1000)
          : undefined,
      },
    })
  }

  const body = await readBody(event)

  // Validate input
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { email, password } = result.data

  // Authenticate user
  const authResult = await authenticateUser(email, password)

  if (!authResult.success) {
    // Record failed attempt for brute force tracking
    recordFailedAttempt(clientIp)

    throw createError({
      statusCode: 401,
      statusMessage: authResult.error || 'Authentication failed',
      data: {
        isLocked: authResult.isLocked,
        remainingAttempts: authResult.remainingAttempts,
      },
    })
  }

  // Reset brute force tracking on successful login
  resetBruteForce(clientIp)

  // Set session using nuxt-auth-utils
  await setUserSession(event, {
    user: authResult.user!,
    loggedInAt: new Date().toISOString(),
  })

  return {
    success: true,
    user: authResult.user,
  }
})
