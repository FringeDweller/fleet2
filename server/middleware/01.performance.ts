/**
 * US-18.1.1: API Response Time <200ms
 * Performance monitoring middleware that:
 * - Adds response time headers (X-Response-Time, Server-Timing)
 * - Logs slow endpoints for optimization
 * - Records metrics for monitoring dashboards
 */

import { PERFORMANCE_THRESHOLDS, recordMetric } from '../utils/performance'

// Target response time in ms
const TARGET_RESPONSE_TIME_MS = PERFORMANCE_THRESHOLDS.API_RESPONSE_MS

// Slow response threshold (for warning logs)
const SLOW_RESPONSE_THRESHOLD_MS = 500

// Endpoints to exclude from timing (health checks, static assets, etc.)
const EXCLUDED_PATHS = ['/api/_health', '/api/_ping', '/_nuxt/', '/__nuxt_error', '/api/auth/']

// Endpoints with relaxed timing requirements (complex reports, exports)
const RELAXED_TIMING_PATHS = ['/api/reports/', '/api/export/', '/api/analytics/']
const RELAXED_TARGET_MS = 2000

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip non-API routes and excluded paths
  if (!path.startsWith('/api/') || EXCLUDED_PATHS.some((p) => path.startsWith(p))) {
    return
  }

  const startTime = performance.now()
  const requestId = crypto.randomUUID().slice(0, 8)

  // Store start time in event context for use by handlers
  event.context.requestStartTime = startTime
  event.context.requestId = requestId

  // Set request ID header early
  setResponseHeader(event, 'X-Request-Id', requestId)

  // Determine if this is a relaxed-timing endpoint
  const isRelaxedTiming = RELAXED_TIMING_PATHS.some((p) => path.startsWith(p))
  const targetMs = isRelaxedTiming ? RELAXED_TARGET_MS : TARGET_RESPONSE_TIME_MS

  // Add hook to capture timing after response
  event.node.res.on('finish', () => {
    const duration = performance.now() - startTime
    const durationMs = Math.round(duration * 100) / 100

    // Record metric for tracking
    recordMetric({
      path,
      method: event.method,
      duration: durationMs,
      isSlowQuery: duration > PERFORMANCE_THRESHOLDS.DB_QUERY_MS,
    })

    // Log slow responses
    if (duration > SLOW_RESPONSE_THRESHOLD_MS) {
      console.warn(
        `[PERF:SLOW] ${event.method} ${path} took ${durationMs}ms (threshold: ${SLOW_RESPONSE_THRESHOLD_MS}ms) [${requestId}]`,
      )
    } else if (duration > targetMs) {
      console.info(
        `[PERF:WARN] ${event.method} ${path} took ${durationMs}ms (target: ${targetMs}ms) [${requestId}]`,
      )
    }
  })

  // Set response timing headers before handlers run
  // These can be overwritten by handlers if needed
  event.node.res.on('prefinish', () => {
    const duration = performance.now() - startTime
    const durationMs = Math.round(duration * 100) / 100

    // Only set headers if they haven't been sent yet
    if (!event.node.res.headersSent) {
      setResponseHeader(event, 'X-Response-Time', `${durationMs}ms`)
      setResponseHeader(event, 'Server-Timing', `total;dur=${durationMs}`)
    }
  })
})
