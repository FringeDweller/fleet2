/**
 * US-18.1.3: DB Query Performance Monitoring
 * Tracks query execution times and identifies slow queries
 */

import { PERFORMANCE_THRESHOLDS } from './performance'

// Query metrics storage
interface QueryMetric {
  query: string
  duration: number
  timestamp: number
  params?: unknown[]
}

// In-memory ring buffer for query metrics
const MAX_QUERY_METRICS = 500
const queryMetrics: QueryMetric[] = []
let queryMetricsIndex = 0

// Slow query log (keeps track of consistently slow queries)
const slowQueryCounts = new Map<
  string,
  { count: number; totalDuration: number; lastSeen: number }
>()

/**
 * Record a query execution
 */
export function recordQuery(query: string, duration: number, params?: unknown[]): void {
  const metric: QueryMetric = {
    query: normalizeQuery(query),
    duration,
    timestamp: Date.now(),
    params,
  }

  // Add to ring buffer
  if (queryMetrics.length < MAX_QUERY_METRICS) {
    queryMetrics.push(metric)
  } else {
    queryMetrics[queryMetricsIndex] = metric
  }
  queryMetricsIndex = (queryMetricsIndex + 1) % MAX_QUERY_METRICS

  // Track slow queries
  if (duration > PERFORMANCE_THRESHOLDS.DB_QUERY_MS) {
    const existing = slowQueryCounts.get(metric.query) || {
      count: 0,
      totalDuration: 0,
      lastSeen: 0,
    }
    existing.count++
    existing.totalDuration += duration
    existing.lastSeen = Date.now()
    slowQueryCounts.set(metric.query, existing)

    // Log slow query warning
    console.warn(
      `[DB:SLOW] Query took ${Math.round(duration)}ms (threshold: ${PERFORMANCE_THRESHOLDS.DB_QUERY_MS}ms)`,
      { query: metric.query.substring(0, 200) },
    )
  }
}

/**
 * Normalize a query for grouping (remove specific values)
 */
function normalizeQuery(query: string): string {
  return (
    query
      // Remove specific UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '?')
      // Remove numbers in VALUES
      .replace(/VALUES\s*\([^)]+\)/gi, 'VALUES (?)')
      // Remove string literals
      .replace(/'[^']*'/g, '?')
      // Remove numeric literals
      .replace(/\b\d+\b/g, '?')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Get slow query statistics
 */
export function getSlowQueryStats(): Array<{
  query: string
  count: number
  avgDuration: number
  lastSeen: Date
}> {
  return Array.from(slowQueryCounts.entries())
    .map(([query, stats]) => ({
      query,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      lastSeen: new Date(stats.lastSeen),
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 20)
}

/**
 * Get query metrics summary
 */
export function getQueryMetricsSummary(): {
  totalQueries: number
  averageQueryTime: number
  slowQueries: number
  queryDistribution: {
    fast: number // < 50ms
    normal: number // 50-100ms
    slow: number // > 100ms
  }
} {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      queryDistribution: { fast: 0, normal: 0, slow: 0 },
    }
  }

  const totalQueries = queryMetrics.length
  const totalDuration = queryMetrics.reduce((sum, m) => sum + m.duration, 0)
  const averageQueryTime = Math.round(totalDuration / totalQueries)
  const slowQueries = queryMetrics.filter(
    (m) => m.duration > PERFORMANCE_THRESHOLDS.DB_QUERY_MS,
  ).length

  const queryDistribution = {
    fast: queryMetrics.filter((m) => m.duration < 50).length,
    normal: queryMetrics.filter((m) => m.duration >= 50 && m.duration <= 100).length,
    slow: queryMetrics.filter((m) => m.duration > 100).length,
  }

  return {
    totalQueries,
    averageQueryTime,
    slowQueries,
    queryDistribution,
  }
}

/**
 * Clear old slow query data (for maintenance)
 */
export function clearOldSlowQueryData(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs
  for (const [query, stats] of slowQueryCounts.entries()) {
    if (stats.lastSeen < cutoff) {
      slowQueryCounts.delete(query)
    }
  }
}

/**
 * Wrap a database query function with monitoring
 */
export async function monitorQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await queryFn()
    const duration = performance.now() - start
    recordQuery(queryName, duration)
    return result
  } catch (error) {
    const duration = performance.now() - start
    recordQuery(`ERROR: ${queryName}`, duration)
    throw error
  }
}
