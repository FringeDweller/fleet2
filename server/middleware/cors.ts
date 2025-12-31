/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 *
 * Implements proper CORS headers for API routes with security considerations:
 * - Dynamic origin validation based on environment
 * - Restricts allowed origins in production (not wildcard)
 * - Configurable via environment variables
 *
 * @see US-18.2 Security Requirements
 */

import type { H3Event } from 'h3'

// Cache allowed origins (parsed once at startup)
let cachedAllowedOrigins: string[] | null = null

/**
 * Get allowed origins from environment configuration
 * In production, only explicitly allowed origins are permitted
 * In development, localhost variants are allowed
 */
function getAllowedOrigins(): string[] {
  if (cachedAllowedOrigins) {
    return cachedAllowedOrigins
  }

  const config = useRuntimeConfig()
  const origins: string[] = []

  // Add configured app URL (primary origin)
  if (config.public.appUrl) {
    origins.push(config.public.appUrl)
  }

  // Parse additional origins from environment variable (comma-separated)
  // Example: CORS_ALLOWED_ORIGINS=https://admin.fleet2.com,https://mobile.fleet2.com
  const additionalOrigins = process.env.CORS_ALLOWED_ORIGINS
  if (additionalOrigins) {
    const parsed = additionalOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
    origins.push(...parsed)
  }

  // In development, allow localhost variants
  if (process.env.NODE_ENV !== 'production') {
    // Add common localhost ports
    const devPorts = ['3000', '3001', '3002', '5000', '8080']
    for (const port of devPorts) {
      origins.push(`http://localhost:${port}`)
      origins.push(`http://127.0.0.1:${port}`)
    }
    // Allow any origin in development if no specific origins configured
    if (origins.length === 0) {
      // Return empty to signal "allow all" in dev mode
      cachedAllowedOrigins = []
      return cachedAllowedOrigins
    }
  }

  cachedAllowedOrigins = origins
  return cachedAllowedOrigins
}

/**
 * Check if the request origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Same-origin requests may not have origin header
    return true
  }

  const allowedOrigins = getAllowedOrigins()

  // In development with no configured origins, allow all
  if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) {
    return true
  }

  // Check if origin is in allowed list
  return allowedOrigins.includes(origin)
}

/**
 * Get the Access-Control-Allow-Origin value
 * Never use wildcard (*) in production with credentials
 */
function getAllowOriginHeader(event: H3Event): string | null {
  const origin = getHeader(event, 'origin')

  // No origin header - same-origin request, no CORS needed
  if (!origin) {
    return null
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin)) {
    return null
  }

  // Return the actual origin (not wildcard) when credentials are used
  return origin
}

export default defineEventHandler((event) => {
  const path = event.path || ''
  const method = event.method?.toUpperCase() || 'GET'

  // Only apply CORS to API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Get the allowed origin for this request
  const allowOrigin = getAllowOriginHeader(event)

  // Handle preflight requests (OPTIONS)
  if (method === 'OPTIONS') {
    // If origin is not allowed, return 403
    if (!allowOrigin && getHeader(event, 'origin')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Origin not allowed by CORS policy',
      })
    }

    // Set CORS headers for preflight
    if (allowOrigin) {
      setResponseHeader(event, 'Access-Control-Allow-Origin', allowOrigin)
    }
    setResponseHeader(
      event,
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    )
    setResponseHeader(
      event,
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token',
    )
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    // Cache preflight for 24 hours (h3 expects number for this header)
    setResponseHeader(event, 'Access-Control-Max-Age', 86400)
    // Expose rate limit and CSRF headers
    setResponseHeader(
      event,
      'Access-Control-Expose-Headers',
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-CSRF-Token',
    )

    // Respond to preflight with 204 No Content
    setResponseStatus(event, 204)
    return ''
  }

  // For actual requests, set CORS headers
  if (allowOrigin) {
    setResponseHeader(event, 'Access-Control-Allow-Origin', allowOrigin)
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setResponseHeader(
      event,
      'Access-Control-Expose-Headers',
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-CSRF-Token',
    )
  }

  // Block cross-origin requests from disallowed origins in production
  const origin = getHeader(event, 'origin')
  if (origin && !allowOrigin && process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Origin not allowed by CORS policy',
    })
  }
})
