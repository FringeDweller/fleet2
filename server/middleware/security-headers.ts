/**
 * Security Headers Middleware
 *
 * Implements comprehensive HTTP security headers for defense-in-depth protection.
 * This middleware provides configurable security headers that can be customized
 * via environment variables or runtime configuration.
 *
 * Headers implemented:
 * 1. Content-Security-Policy (CSP) - Restrict resource loading
 * 2. X-Content-Type-Options - Prevent MIME sniffing
 * 3. X-Frame-Options - Prevent clickjacking
 * 4. X-XSS-Protection - XSS filter for legacy browsers
 * 5. Referrer-Policy - Control referrer information
 * 6. Permissions-Policy - Control browser features
 * 7. Strict-Transport-Security (HSTS) - Enforce HTTPS
 *
 * @see US-18 Security Requirements
 * @see US-18.2.1 TLS 1.3 Encryption
 * @see US-18.2.4 XSS Prevention
 */

import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// Configuration Types
// ---------------------------------------------------------------------------

/**
 * Security headers configuration interface
 * Can be customized via environment variables or runtime config
 */
interface SecurityHeadersConfig {
  /**
   * Enable/disable security headers middleware
   * @default true
   * @env SECURITY_HEADERS_ENABLED
   */
  enabled: boolean

  /**
   * HSTS (HTTP Strict Transport Security) configuration
   */
  hsts: {
    /**
     * Enable HSTS header (only in production by default)
     * @default true in production
     * @env SECURITY_HSTS_ENABLED
     */
    enabled: boolean

    /**
     * HSTS max-age in seconds
     * @default 31536000 (1 year)
     * @env SECURITY_HSTS_MAX_AGE
     */
    maxAge: number

    /**
     * Include subdomains in HSTS
     * @default true
     * @env SECURITY_HSTS_INCLUDE_SUBDOMAINS
     */
    includeSubDomains: boolean

    /**
     * Enable HSTS preload for browser preload lists
     * @default true
     * @env SECURITY_HSTS_PRELOAD
     */
    preload: boolean
  }

  /**
   * Content Security Policy configuration
   */
  csp: {
    /**
     * Enable CSP header
     * @default true
     * @env SECURITY_CSP_ENABLED
     */
    enabled: boolean

    /**
     * Use report-only mode (doesn't block, only reports violations)
     * @default false
     * @env SECURITY_CSP_REPORT_ONLY
     */
    reportOnly: boolean

    /**
     * URL to report CSP violations to
     * @env SECURITY_CSP_REPORT_URI
     */
    reportUri?: string

    /**
     * Custom CSP directives to merge with defaults
     * @env SECURITY_CSP_CUSTOM (JSON string)
     */
    customDirectives?: Record<string, string>
  }

  /**
   * Frame options configuration
   */
  frameOptions: {
    /**
     * Enable X-Frame-Options header
     * @default true
     * @env SECURITY_FRAME_OPTIONS_ENABLED
     */
    enabled: boolean

    /**
     * Frame options value: 'DENY' or 'SAMEORIGIN'
     * @default 'DENY'
     * @env SECURITY_FRAME_OPTIONS_VALUE
     */
    value: 'DENY' | 'SAMEORIGIN'
  }

  /**
   * Referrer Policy configuration
   */
  referrerPolicy: {
    /**
     * Enable Referrer-Policy header
     * @default true
     * @env SECURITY_REFERRER_POLICY_ENABLED
     */
    enabled: boolean

    /**
     * Referrer policy value
     * @default 'strict-origin-when-cross-origin'
     * @env SECURITY_REFERRER_POLICY_VALUE
     */
    value: string
  }

  /**
   * Permissions Policy configuration
   */
  permissionsPolicy: {
    /**
     * Enable Permissions-Policy header
     * @default true
     * @env SECURITY_PERMISSIONS_POLICY_ENABLED
     */
    enabled: boolean

    /**
     * Allow geolocation for fleet tracking
     * @default 'self'
     * @env SECURITY_PERMISSIONS_GEOLOCATION
     */
    geolocation: string

    /**
     * Custom permissions to add
     * @env SECURITY_PERMISSIONS_CUSTOM (JSON string)
     */
    custom?: Record<string, string>
  }

  /**
   * Cross-Origin headers configuration
   */
  crossOrigin: {
    /**
     * Enable Cross-Origin-Opener-Policy header
     * @default true
     * @env SECURITY_COOP_ENABLED
     */
    coopEnabled: boolean

    /**
     * COOP value
     * @default 'same-origin'
     */
    coopValue: string

    /**
     * Enable Cross-Origin-Resource-Policy header
     * @default true
     * @env SECURITY_CORP_ENABLED
     */
    corpEnabled: boolean

    /**
     * CORP value
     * @default 'same-origin'
     */
    corpValue: string
  }
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

/**
 * Get default security headers configuration
 * Merges environment variables with sensible defaults
 */
function getDefaultConfig(): SecurityHeadersConfig {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    enabled: process.env.SECURITY_HEADERS_ENABLED !== 'false',

    hsts: {
      enabled: isProduction && process.env.SECURITY_HSTS_ENABLED !== 'false',
      maxAge: Number.parseInt(process.env.SECURITY_HSTS_MAX_AGE || '31536000', 10),
      includeSubDomains: process.env.SECURITY_HSTS_INCLUDE_SUBDOMAINS !== 'false',
      preload: process.env.SECURITY_HSTS_PRELOAD !== 'false',
    },

    csp: {
      enabled: process.env.SECURITY_CSP_ENABLED !== 'false',
      reportOnly: process.env.SECURITY_CSP_REPORT_ONLY === 'true',
      reportUri: process.env.SECURITY_CSP_REPORT_URI,
      customDirectives: parseJsonEnv('SECURITY_CSP_CUSTOM'),
    },

    frameOptions: {
      enabled: process.env.SECURITY_FRAME_OPTIONS_ENABLED !== 'false',
      value: (process.env.SECURITY_FRAME_OPTIONS_VALUE as 'DENY' | 'SAMEORIGIN') || 'DENY',
    },

    referrerPolicy: {
      enabled: process.env.SECURITY_REFERRER_POLICY_ENABLED !== 'false',
      value: process.env.SECURITY_REFERRER_POLICY_VALUE || 'strict-origin-when-cross-origin',
    },

    permissionsPolicy: {
      enabled: process.env.SECURITY_PERMISSIONS_POLICY_ENABLED !== 'false',
      geolocation: process.env.SECURITY_PERMISSIONS_GEOLOCATION || 'self',
      custom: parseJsonEnv('SECURITY_PERMISSIONS_CUSTOM'),
    },

    crossOrigin: {
      coopEnabled: process.env.SECURITY_COOP_ENABLED !== 'false',
      coopValue: process.env.SECURITY_COOP_VALUE || 'same-origin',
      corpEnabled: process.env.SECURITY_CORP_ENABLED !== 'false',
      corpValue: process.env.SECURITY_CORP_VALUE || 'same-origin',
    },
  }
}

/**
 * Parse JSON from environment variable safely
 */
function parseJsonEnv(envName: string): Record<string, string> | undefined {
  const value = process.env[envName]
  if (!value) return undefined

  try {
    return JSON.parse(value)
  } catch {
    console.warn(`[SecurityHeaders] Invalid JSON in ${envName}:`, value)
    return undefined
  }
}

// ---------------------------------------------------------------------------
// CSP Builder
// ---------------------------------------------------------------------------

/**
 * Build Content Security Policy directives
 *
 * @param config - CSP configuration options
 * @returns CSP header value string
 *
 * @see US-18.2.4 XSS Prevention
 */
function buildCspDirectives(config: SecurityHeadersConfig['csp']): string {
  const isProduction = process.env.NODE_ENV === 'production'

  // Base directives for secure operation
  const directives: Record<string, string> = {
    // Default: only allow same-origin resources
    'default-src': "'self'",

    // Scripts: self + inline scripts (required for Vue/Nuxt)
    // Note: Consider using nonces for stricter production CSP
    // Using 'unsafe-eval' for Vue's runtime compiler, can be removed if using pre-compiled templates
    'script-src': "'self' 'unsafe-inline' 'unsafe-eval' blob:",

    // Styles: self + inline (required for Tailwind/Vue dynamic styles)
    'style-src': "'self' 'unsafe-inline'",

    // Images: self + data URIs (icons, inline images) + blob (image processing) + https (external)
    'img-src': "'self' data: blob: https:",

    // Fonts: self + data URIs (inline fonts)
    'font-src': "'self' data:",

    // API connections: self + WebSockets for real-time updates
    'connect-src': "'self' ws: wss:",

    // Media: self + blob (for audio/video processing)
    'media-src': "'self' blob:",

    // Prevent Flash/Java plugins
    'object-src': "'none'",

    // Prevent base tag injection attacks
    'base-uri': "'self'",

    // Restrict form submission targets
    'form-action': "'self'",

    // Prevent clickjacking via frame embedding (replaces X-Frame-Options)
    'frame-ancestors': "'none'",

    // Worker scripts
    'worker-src': "'self' blob:",

    // Child frames/iframes
    'child-src': "'self' blob:",

    // Manifest files for PWA
    'manifest-src': "'self'",
  }

  // Production-only directives
  if (isProduction) {
    // Automatically upgrade HTTP to HTTPS
    directives['upgrade-insecure-requests'] = ''
  }

  // Merge custom directives from config
  if (config.customDirectives) {
    for (const [key, value] of Object.entries(config.customDirectives)) {
      directives[key] = value
    }
  }

  // Add report URI if configured
  if (config.reportUri) {
    directives['report-uri'] = config.reportUri
    // Modern browsers use report-to directive
    directives['report-to'] = 'csp-endpoint'
  }

  // Build the CSP string
  return Object.entries(directives)
    .map(([directive, value]) => {
      // Handle empty values (like upgrade-insecure-requests)
      return value ? `${directive} ${value}` : directive
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Permissions Policy Builder
// ---------------------------------------------------------------------------

/**
 * Build Permissions Policy header value
 *
 * Restricts access to browser features for security and privacy.
 * Fleet2-specific: Allows geolocation for fleet tracking functionality.
 *
 * @param config - Permissions policy configuration
 * @returns Permissions-Policy header value
 */
function buildPermissionsPolicy(config: SecurityHeadersConfig['permissionsPolicy']): string {
  // Default permissions - restrict most sensitive APIs
  const permissions: Record<string, string> = {
    // Camera: disabled (not needed for fleet management)
    camera: '()',

    // Microphone: disabled (not needed)
    microphone: '()',

    // Geolocation: configurable, needed for fleet tracking
    geolocation: config.geolocation === 'self' ? '(self)' : `(${config.geolocation})`,

    // Payment APIs: disabled (not handling payments in-app)
    payment: '()',

    // USB access: disabled (security risk)
    usb: '()',

    // Serial port: disabled (security risk)
    serial: '()',

    // Bluetooth: disabled (security risk)
    bluetooth: '()',

    // MIDI devices: disabled (not needed)
    midi: '()',

    // Screen wake lock: allow for tracking dashboards
    'screen-wake-lock': '(self)',

    // Fullscreen: allow for dashboards and reports
    fullscreen: '(self)',

    // Accelerometer: disabled unless needed for mobile
    accelerometer: '()',

    // Gyroscope: disabled unless needed for mobile
    gyroscope: '()',

    // Magnetometer: disabled
    magnetometer: '()',

    // Picture-in-picture: disabled
    'picture-in-picture': '()',

    // Autoplay: restricted to same-origin
    autoplay: '(self)',

    // Encrypted media: allow for any media playback
    'encrypted-media': '(self)',

    // Disable Google's FLoC tracking
    'interest-cohort': '()',

    // Disable ad attribution
    'attribution-reporting': '()',

    // Disable idle detection
    'idle-detection': '()',

    // Disable compute pressure API
    'compute-pressure': '()',

    // Disable shared storage
    'shared-storage': '()',

    // Disable topics API (Privacy Sandbox)
    'browsing-topics': '()',
  }

  // Merge custom permissions
  if (config.custom) {
    for (const [feature, value] of Object.entries(config.custom)) {
      permissions[feature] = value
    }
  }

  // Build the header value
  return Object.entries(permissions)
    .map(([feature, value]) => `${feature}=${value}`)
    .join(', ')
}

// ---------------------------------------------------------------------------
// Response Type Detection
// ---------------------------------------------------------------------------

/**
 * Check if the response is an HTML document
 * Security headers like CSP are most relevant for HTML responses
 */
function isHtmlResponse(event: H3Event): boolean {
  const path = event.path || ''

  // API responses are JSON, not HTML
  if (path.startsWith('/api/')) {
    return false
  }

  // Static assets
  const staticExtensions = [
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.map',
    '.json',
  ]
  if (staticExtensions.some((ext) => path.endsWith(ext))) {
    return false
  }

  // Nuxt internal routes
  if (path.startsWith('/_nuxt/') || path.startsWith('/__nuxt')) {
    return false
  }

  // Assume all other routes are HTML pages
  return true
}

/**
 * Check if this is an API response that should get minimal headers
 */
function isApiResponse(event: H3Event): boolean {
  const path = event.path || ''
  return path.startsWith('/api/')
}

// ---------------------------------------------------------------------------
// Main Middleware Handler
// ---------------------------------------------------------------------------

/**
 * Security Headers Middleware
 *
 * Applies comprehensive HTTP security headers for defense-in-depth.
 * Configuration can be customized via environment variables.
 *
 * @see US-18 Security Requirements
 */
export default defineEventHandler((event) => {
  const config = getDefaultConfig()

  // Skip if middleware is disabled
  if (!config.enabled) {
    return
  }

  // Helper to set headers
  const setSecurityHeader = (name: string, value: string) => {
    setResponseHeader(event, name, value)
  }

  // ---------------------------------------------------------------------------
  // US-18.2.1: HSTS (HTTP Strict Transport Security)
  // ---------------------------------------------------------------------------
  // HSTS instructs browsers to only use HTTPS connections
  // This prevents SSL stripping attacks and protocol downgrade attacks
  if (config.hsts.enabled) {
    const hstsParts = [`max-age=${config.hsts.maxAge}`]

    if (config.hsts.includeSubDomains) {
      hstsParts.push('includeSubDomains')
    }

    if (config.hsts.preload) {
      hstsParts.push('preload')
    }

    setSecurityHeader('Strict-Transport-Security', hstsParts.join('; '))
  }

  // ---------------------------------------------------------------------------
  // X-Content-Type-Options: nosniff
  // ---------------------------------------------------------------------------
  // Prevents browsers from MIME-sniffing a response away from the declared content-type
  // This mitigates attacks where attackers try to execute code via MIME confusion
  // Always enabled - no configuration option as this should never be disabled
  setSecurityHeader('X-Content-Type-Options', 'nosniff')

  // ---------------------------------------------------------------------------
  // X-Frame-Options
  // ---------------------------------------------------------------------------
  // Legacy header to prevent clickjacking attacks
  // frame-ancestors CSP directive is the modern replacement
  // We still include this for compatibility with older browsers
  if (config.frameOptions.enabled) {
    setSecurityHeader('X-Frame-Options', config.frameOptions.value)
  }

  // ---------------------------------------------------------------------------
  // X-XSS-Protection: 1; mode=block
  // ---------------------------------------------------------------------------
  // Legacy XSS filter for older browsers
  // Modern browsers have deprecated this in favor of CSP
  // We still include it for defense-in-depth on legacy browsers
  // Note: Some security researchers recommend disabling this (X-XSS-Protection: 0)
  // as it can introduce vulnerabilities, but we keep it for broader protection
  setSecurityHeader('X-XSS-Protection', '1; mode=block')

  // ---------------------------------------------------------------------------
  // Referrer-Policy
  // ---------------------------------------------------------------------------
  // Controls how much referrer information is included with requests
  // 'strict-origin-when-cross-origin' is a good balance of functionality and privacy:
  // - Same-origin: full URL
  // - Cross-origin to HTTPS: origin only
  // - Cross-origin to HTTP: no referrer
  if (config.referrerPolicy.enabled) {
    setSecurityHeader('Referrer-Policy', config.referrerPolicy.value)
  }

  // ---------------------------------------------------------------------------
  // Permissions-Policy (formerly Feature-Policy)
  // ---------------------------------------------------------------------------
  // Restricts access to browser features/APIs
  // This provides additional protection against malicious scripts
  if (config.permissionsPolicy.enabled) {
    const permissionsValue = buildPermissionsPolicy(config.permissionsPolicy)
    setSecurityHeader('Permissions-Policy', permissionsValue)
  }

  // ---------------------------------------------------------------------------
  // Cross-Origin Headers
  // ---------------------------------------------------------------------------

  // Cross-Origin-Opener-Policy (COOP)
  // Prevents other pages from opening/accessing this page's window
  // 'same-origin' provides strong isolation
  if (config.crossOrigin.coopEnabled) {
    setSecurityHeader('Cross-Origin-Opener-Policy', config.crossOrigin.coopValue)
  }

  // Cross-Origin-Resource-Policy (CORP)
  // Restricts which sites can include this resource
  // 'same-origin' prevents cross-site resource leaks
  if (config.crossOrigin.corpEnabled) {
    setSecurityHeader('Cross-Origin-Resource-Policy', config.crossOrigin.corpValue)
  }

  // ---------------------------------------------------------------------------
  // Content Security Policy
  // ---------------------------------------------------------------------------
  // CSP is the primary defense against XSS and injection attacks
  // Only apply full CSP to HTML responses - API responses don't need script restrictions
  if (config.csp.enabled) {
    const cspValue = buildCspDirectives(config.csp)

    // Use report-only mode if configured (useful for testing)
    const headerName = config.csp.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'

    // For API responses, use a minimal CSP
    if (isApiResponse(event)) {
      // API responses: minimal CSP, just prevent framing
      setSecurityHeader(headerName, "default-src 'none'; frame-ancestors 'none'")
    } else {
      // HTML responses: full CSP
      setSecurityHeader(headerName, cspValue)
    }
  }

  // ---------------------------------------------------------------------------
  // Report-To Header (for CSP reporting)
  // ---------------------------------------------------------------------------
  // Modern CSP reporting endpoint configuration
  if (config.csp.reportUri) {
    const reportToValue = JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400, // ~126 days
      endpoints: [{ url: config.csp.reportUri }],
    })
    setSecurityHeader('Report-To', reportToValue)
  }

  // ---------------------------------------------------------------------------
  // Cache-Control for Security
  // ---------------------------------------------------------------------------
  // For HTML pages with sensitive content, prevent caching
  // This ensures authenticated content isn't cached and served to unauthorized users
  if (isHtmlResponse(event)) {
    const path = event.path || ''

    // Authenticated pages should not be cached
    if (!path.startsWith('/auth/') && !path.startsWith('/login')) {
      setSecurityHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      setSecurityHeader('Pragma', 'no-cache')
      setSecurityHeader('Expires', '0')
    }
  }
})
