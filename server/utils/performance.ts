/**
 * US-18.1.1 & US-18.1.3: Performance monitoring utilities
 * Provides tools for measuring and tracking API/DB performance
 */

import type { H3Event } from 'h3'

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_MS: 200, // US-18.1.1: Target API response time
  DB_QUERY_MS: 100, // US-18.1.3: Target DB query time
  PAGE_LOAD_MS: 2000, // US-18.1.2: Target page load time
} as const

// Metrics storage for recent performance data
interface PerformanceMetric {
  path: string
  method: string
  duration: number
  timestamp: number
  isSlowQuery?: boolean
}

// In-memory ring buffer for recent metrics (keeps last 1000 entries)
const MAX_METRICS = 1000
const recentMetrics: PerformanceMetric[] = []
let metricsIndex = 0

/**
 * Record a performance metric
 */
export function recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
  const entry: PerformanceMetric = {
    ...metric,
    timestamp: Date.now(),
  }

  if (recentMetrics.length < MAX_METRICS) {
    recentMetrics.push(entry)
  } else {
    recentMetrics[metricsIndex] = entry
  }
  metricsIndex = (metricsIndex + 1) % MAX_METRICS
}

/**
 * Get recent performance metrics summary
 */
export function getMetricsSummary(): {
  totalRequests: number
  averageResponseTime: number
  slowRequests: number
  slowestEndpoints: Array<{ path: string; avgDuration: number; count: number }>
} {
  if (recentMetrics.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      slowestEndpoints: [],
    }
  }

  const totalRequests = recentMetrics.length
  const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0)
  const averageResponseTime = Math.round(totalDuration / totalRequests)
  const slowRequests = recentMetrics.filter(
    (m) => m.duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_MS,
  ).length

  // Group by path and calculate average
  const pathStats = new Map<string, { total: number; count: number }>()
  for (const metric of recentMetrics) {
    const existing = pathStats.get(metric.path) || { total: 0, count: 0 }
    existing.total += metric.duration
    existing.count++
    pathStats.set(metric.path, existing)
  }

  const slowestEndpoints = Array.from(pathStats.entries())
    .map(([path, stats]) => ({
      path,
      avgDuration: Math.round(stats.total / stats.count),
      count: stats.count,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10)

  return {
    totalRequests,
    averageResponseTime,
    slowRequests,
    slowestEndpoints,
  }
}

/**
 * Utility to measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    warnThreshold?: number
    logSlow?: boolean
  } = {},
): Promise<{ result: T; duration: number }> {
  const { warnThreshold = PERFORMANCE_THRESHOLDS.DB_QUERY_MS, logSlow = true } = options

  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start

    if (logSlow && duration > warnThreshold) {
      console.warn(
        `[PERF:SLOW] ${name} took ${Math.round(duration)}ms (threshold: ${warnThreshold}ms)`,
      )
    }

    return { result, duration }
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[PERF:ERROR] ${name} failed after ${Math.round(duration)}ms`)
    throw error
  }
}

/**
 * Set response timing headers on API response
 */
export function setTimingHeaders(event: H3Event, startTime: number): void {
  const duration = performance.now() - startTime
  const durationMs = Math.round(duration * 100) / 100

  setResponseHeader(event, 'X-Response-Time', `${durationMs}ms`)
  setResponseHeader(event, 'Server-Timing', `total;dur=${durationMs}`)

  // Record metric for tracking
  const url = getRequestURL(event)
  recordMetric({
    path: url.pathname,
    method: event.method,
    duration: durationMs,
  })
}

/**
 * Wrap an API handler with automatic timing
 */
export function withTiming<T>(
  handler: (event: H3Event) => Promise<T>,
): (event: H3Event) => Promise<T> {
  return async (event: H3Event) => {
    const startTime = performance.now()
    try {
      const result = await handler(event)
      setTimingHeaders(event, startTime)
      return result
    } catch (error) {
      setTimingHeaders(event, startTime)
      throw error
    }
  }
}
