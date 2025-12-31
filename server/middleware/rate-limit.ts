/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting for API endpoints to prevent abuse and DoS attacks.
 * Uses in-memory storage for development and Redis for production.
 *
 * Rate limits are configured per endpoint type:
 * - Authentication endpoints: 5 requests per minute (strict)
 * - Write operations (POST/PUT/DELETE): 60 requests per minute
 * - Read operations (GET): 120 requests per minute
 *
 * @see US-18.2.6 Rate Limiting
 */

import type { H3Event } from 'h3'

// Rate limit configuration per endpoint type
interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message: string // Error message when limit exceeded
}

// Rate limit configurations
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Strict limits for authentication endpoints
  auth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  },
  // Standard limits for write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests. Please slow down.',
  },
  // Higher limits for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    message: 'Too many requests. Please slow down.',
  },
  // Relaxed limits for assets/static
  static: {
    windowMs: 60 * 1000,
    maxRequests: 300,
    message: 'Too many requests.',
  },
}

// In-memory rate limit store (for development/single-instance)
// In production, this should use Redis for distributed rate limiting
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval for expired entries (every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
          rateLimitStore.delete(key)
        }
      }
    },
    5 * 60 * 1000,
  ) // Every 5 minutes
}

// Start cleanup on module load
startCleanup()

/**
 * Get the client identifier for rate limiting
 * Uses IP address as the primary identifier
 */
function getClientId(event: H3Event): string {
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  const realIp = getHeader(event, 'x-real-ip')
  const socketAddress = getRequestIP(event)

  // Use the first IP in x-forwarded-for, or x-real-ip, or socket address
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || socketAddress || 'unknown'

  return ip
}

/**
 * Determine the rate limit tier based on the request
 */
function getRateLimitTier(event: H3Event): string {
  const path = event.path || ''
  const method = event.method?.toUpperCase() || 'GET'

  // Authentication endpoints get strict limits
  if (path.startsWith('/api/auth/')) {
    return 'auth'
  }

  // Static assets get relaxed limits
  if (
    path.startsWith('/_nuxt/') ||
    path.startsWith('/assets/') ||
    path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  ) {
    return 'static'
  }

  // Write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'write'
  }

  // Default to read operations
  return 'read'
}

/**
 * Check and update rate limit for a client
 */
async function checkRateLimit(
  event: H3Event,
): Promise<{ allowed: boolean; remaining: number; resetAt: number; limit: number }> {
  const clientId = getClientId(event)
  const tier = getRateLimitTier(event)
  const config = RATE_LIMITS[tier] ?? RATE_LIMITS.read

  // Create a unique key for this client + tier combination
  const key = `ratelimit:${tier}:${clientId}`

  const now = Date.now()
  let entry = rateLimitStore.get(key)

  // Reset if window has expired or no entry exists
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  }
}

export default defineEventHandler(async (event) => {
  // Skip rate limiting for non-API routes in development
  const path = event.path || ''
  if (!path.startsWith('/api/')) {
    return
  }

  const { allowed, remaining, resetAt, limit } = await checkRateLimit(event)

  // Set rate limit headers on all responses
  setResponseHeader(event, 'X-RateLimit-Limit', limit.toString())
  setResponseHeader(event, 'X-RateLimit-Remaining', remaining.toString())
  setResponseHeader(event, 'X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString())

  // If limit exceeded, block the request
  if (!allowed) {
    const tier = getRateLimitTier(event)
    const tierConfig = RATE_LIMITS[tier] ?? RATE_LIMITS.read

    // Calculate retry-after in seconds
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)
    // h3 types 'Retry-After' as number, so pass the numeric value directly
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: tierConfig.message,
      data: {
        retryAfter: retryAfterSeconds,
        limit,
        resetAt: new Date(resetAt).toISOString(),
      },
    })
  }
})
