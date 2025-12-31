/**
 * US-18.1.1: API Response Time <200ms
 * Performance monitoring middleware that adds response time headers
 * and logs slow endpoints for optimization
 */

// Target response time in ms
const TARGET_RESPONSE_TIME_MS = 200

// Slow response threshold (for warning logs)
const SLOW_RESPONSE_THRESHOLD_MS = 500

// Endpoints to exclude from timing (health checks, etc.)
const EXCLUDED_PATHS = ['/api/_health', '/api/_ping', '/_nuxt/', '/__nuxt_error']

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip non-API routes and excluded paths
  if (!path.startsWith('/api/') || EXCLUDED_PATHS.some((p) => path.startsWith(p))) {
    return
  }

  const startTime = performance.now()

  // Add hook to capture timing after response
  event.node.res.on('finish', () => {
    const duration = performance.now() - startTime
    const durationMs = Math.round(duration * 100) / 100

    // Set response headers for monitoring
    // Note: Headers must be set before response is sent, so we use a different approach
    // We'll log the metrics instead since headers are already sent by this point

    // Log slow responses
    if (duration > SLOW_RESPONSE_THRESHOLD_MS) {
      console.warn(
        `[PERF:SLOW] ${event.method} ${path} took ${durationMs}ms (threshold: ${SLOW_RESPONSE_THRESHOLD_MS}ms)`,
      )
    } else if (duration > TARGET_RESPONSE_TIME_MS) {
      console.info(
        `[PERF:WARN] ${event.method} ${path} took ${durationMs}ms (target: ${TARGET_RESPONSE_TIME_MS}ms)`,
      )
    }
  })

  // Set timing header early (before handler runs)
  setResponseHeader(event, 'X-Request-Start', Date.now().toString())
})
