/**
 * CSRF Protection Middleware
 *
 * Implements CSRF (Cross-Site Request Forgery) protection using the
 * Double Submit Cookie pattern combined with Origin/Referer validation.
 *
 * Protection mechanisms:
 * 1. Origin/Referer header validation for state-changing requests
 * 2. CSRF token validation via X-CSRF-Token header
 * 3. SameSite cookie attribute (configured in nuxt-auth-utils)
 *
 * State-changing methods that require CSRF protection:
 * - POST, PUT, PATCH, DELETE
 *
 * @see US-18.2.5 CSRF Protection
 */

import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

// CSRF token cookie name
const CSRF_COOKIE_NAME = 'fleet2_csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

// Paths excluded from CSRF protection (e.g., webhook endpoints)
const EXCLUDED_PATHS = [
  '/api/webhooks/', // External webhook callbacks
  '/api/health', // Health checks
  '/api/metrics', // Metrics endpoint
]

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Get the expected origin from the request
 */
function getExpectedOrigins(event: H3Event): string[] {
  const config = useRuntimeConfig()
  const host = getHeader(event, 'host') || ''

  // Build expected origins list
  const origins: string[] = []

  // Add configured app URL if available
  if (config.public.appUrl) {
    origins.push(config.public.appUrl)
  }

  // Add origins based on host header
  if (host) {
    origins.push(`https://${host}`)
    origins.push(`http://${host}`) // For development
  }

  // Add localhost variants for development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
    origins.push('http://localhost:3001')
    origins.push('http://127.0.0.1:3000')
  }

  return origins
}

/**
 * Validate Origin/Referer header
 * Returns true if the request origin matches expected origins
 */
function validateOrigin(event: H3Event): boolean {
  const origin = getHeader(event, 'origin')
  const referer = getHeader(event, 'referer')

  // Get the origin from the referer if origin is not present
  let requestOrigin = origin
  if (!requestOrigin && referer) {
    try {
      const url = new URL(referer)
      requestOrigin = url.origin
    } catch {
      // Invalid referer URL
      return false
    }
  }

  // If no origin information, reject for safety
  // (Some browsers don't send origin for same-origin requests, but we require it)
  if (!requestOrigin) {
    // For API calls from same-origin, check if referer matches
    if (referer) {
      const expectedOrigins = getExpectedOrigins(event)
      return expectedOrigins.some((expected) => referer.startsWith(expected))
    }

    // Allow requests without origin in development for testing
    if (process.env.NODE_ENV !== 'production') {
      return true
    }

    return false
  }

  const expectedOrigins = getExpectedOrigins(event)
  return expectedOrigins.includes(requestOrigin)
}

/**
 * Validate CSRF token from header against cookie
 */
function validateCsrfToken(event: H3Event): boolean {
  const tokenFromCookie = getCookie(event, CSRF_COOKIE_NAME)
  const tokenFromHeader = getHeader(event, CSRF_HEADER_NAME)

  // Both tokens must be present and match
  if (!tokenFromCookie || !tokenFromHeader) {
    return false
  }

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(tokenFromCookie, tokenFromHeader)
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Check if path is excluded from CSRF protection
 */
function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  const method = event.method?.toUpperCase() || 'GET'

  // Only apply to API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Skip excluded paths
  if (isExcludedPath(path)) {
    return
  }

  // For all requests, ensure CSRF cookie exists
  let csrfToken = getCookie(event, CSRF_COOKIE_NAME)

  if (!csrfToken) {
    // Generate and set new CSRF token
    csrfToken = generateCsrfToken()

    setCookie(event, CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be readable by JavaScript to send in header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }

  // Expose the CSRF token in response header for client to read
  setResponseHeader(event, 'X-CSRF-Token', csrfToken)

  // Check if this is a state-changing request
  if (!PROTECTED_METHODS.includes(method)) {
    return // GET, HEAD, OPTIONS don't need CSRF protection
  }

  // Validate Origin/Referer
  if (!validateOrigin(event)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Invalid origin. Cross-site request detected.',
      data: { code: 'CSRF_ORIGIN_MISMATCH' },
    })
  }

  // Validate CSRF token
  if (!validateCsrfToken(event)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Invalid or missing CSRF token. Please refresh and try again.',
      data: { code: 'CSRF_TOKEN_INVALID' },
    })
  }
})
