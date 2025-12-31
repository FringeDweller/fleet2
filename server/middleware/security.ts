/**
 * Security Middleware
 *
 * Implements comprehensive security headers for the Fleet2 application:
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - XSS Protection
 * - Content Type Options
 * - Frame Options
 * - Referrer Policy
 *
 * @see US-18.2.1 TLS 1.3 Encryption
 * @see US-18.2.4 XSS Prevention
 */

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const isProduction = process.env.NODE_ENV === 'production'

  // Get response headers helper
  const setSecurityHeader = (name: string, value: string) => {
    setResponseHeader(event, name, value)
  }

  // -----------------------------------------------------------------------------
  // US-18.2.1: HSTS (HTTP Strict Transport Security)
  // -----------------------------------------------------------------------------
  // In production, enforce HTTPS with HSTS
  // max-age: 1 year (31536000 seconds)
  // includeSubDomains: Apply to all subdomains
  // preload: Allow inclusion in browser preload lists
  if (isProduction) {
    setSecurityHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // -----------------------------------------------------------------------------
  // US-18.2.4: XSS Prevention Headers
  // -----------------------------------------------------------------------------

  // Content Security Policy
  // Restricts sources for scripts, styles, images, fonts, connections, etc.
  const cspDirectives = [
    // Default: only allow same-origin
    "default-src 'self'",

    // Scripts: self + inline scripts (Vue needs them) + blob for workers
    // Note: In production, consider using nonces for stricter CSP
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",

    // Styles: self + inline (Tailwind/Vue needs them)
    "style-src 'self' 'unsafe-inline'",

    // Images: self + data URIs + blob + https sources (for external images)
    "img-src 'self' data: blob: https:",

    // Fonts: self + data URIs
    "font-src 'self' data:",

    // Connections: self + same origin + websockets
    "connect-src 'self' ws: wss:",

    // Media: self + blob
    "media-src 'self' blob:",

    // Object/embed: none (prevent Flash/plugins)
    "object-src 'none'",

    // Base URI: self (prevent base tag injection)
    "base-uri 'self'",

    // Form actions: self (prevent form hijacking)
    "form-action 'self'",

    // Frame ancestors: none (prevent clickjacking - like X-Frame-Options)
    "frame-ancestors 'none'",

    // Upgrade insecure requests in production
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ]

  setSecurityHeader('Content-Security-Policy', cspDirectives.join('; '))

  // X-Content-Type-Options: Prevent MIME type sniffing
  setSecurityHeader('X-Content-Type-Options', 'nosniff')

  // X-Frame-Options: Prevent clickjacking (legacy, CSP frame-ancestors is preferred)
  setSecurityHeader('X-Frame-Options', 'DENY')

  // X-XSS-Protection: Enable browser XSS filter (legacy but still useful)
  // Note: Modern browsers largely ignore this, CSP is the primary defense
  setSecurityHeader('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy: Control referrer information leakage
  setSecurityHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy: Restrict browser features
  // Disable camera, microphone, geolocation, payment APIs, etc.
  const permissionsPolicy = [
    'camera=()',
    'microphone=()',
    'geolocation=(self)', // Allow geolocation for fleet tracking
    'payment=()',
    'usb=()',
    'interest-cohort=()', // Disable FLoC
  ]
  setSecurityHeader('Permissions-Policy', permissionsPolicy.join(', '))

  // Cross-Origin-Embedder-Policy: Require CORP for cross-origin resources
  // Note: Only enable if all cross-origin resources have proper CORP headers
  // setSecurityHeader('Cross-Origin-Embedder-Policy', 'require-corp')

  // Cross-Origin-Opener-Policy: Isolate browsing context
  setSecurityHeader('Cross-Origin-Opener-Policy', 'same-origin')

  // Cross-Origin-Resource-Policy: Restrict resource access
  setSecurityHeader('Cross-Origin-Resource-Policy', 'same-origin')
})
