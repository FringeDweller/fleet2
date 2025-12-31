/**
 * US-18.1.3: DB Query Performance Monitoring
 * Tracks query execution times and identifies slow queries
 *
 * Features:
 * - Real-time query timing and logging
 * - Slow query detection and aggregation
 * - Query pattern analysis for optimization hints
 * - Exportable metrics for monitoring dashboards
 */

import { PERFORMANCE_THRESHOLDS } from './performance'

// Query metrics storage
interface QueryMetric {
  query: string
  duration: number
  timestamp: number
  params?: unknown[]
  table?: string
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
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

/**
 * Extract table name from a query string
 */
function extractTableName(query: string): string | undefined {
  // Match common SQL patterns
  const fromMatch = query.match(/FROM\s+["']?(\w+)["']?/i)
  if (fromMatch) return fromMatch[1]

  const insertMatch = query.match(/INSERT\s+INTO\s+["']?(\w+)["']?/i)
  if (insertMatch) return insertMatch[1]

  const updateMatch = query.match(/UPDATE\s+["']?(\w+)["']?/i)
  if (updateMatch) return updateMatch[1]

  const deleteMatch = query.match(/DELETE\s+FROM\s+["']?(\w+)["']?/i)
  if (deleteMatch) return deleteMatch[1]

  return undefined
}

/**
 * Extract operation type from a query string
 */
export function extractOperation(
  query: string,
): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
  const upper = query.trim().toUpperCase()
  if (upper.startsWith('SELECT')) return 'SELECT'
  if (upper.startsWith('INSERT')) return 'INSERT'
  if (upper.startsWith('UPDATE')) return 'UPDATE'
  if (upper.startsWith('DELETE')) return 'DELETE'
  return 'OTHER'
}

/**
 * Get statistics grouped by table
 */
export function getQueryStatsByTable(): Array<{
  table: string
  count: number
  avgDuration: number
  slowCount: number
}> {
  const tableStats = new Map<string, { count: number; totalDuration: number; slowCount: number }>()

  for (const metric of queryMetrics) {
    const table = extractTableName(metric.query) || 'unknown'
    const existing = tableStats.get(table) || { count: 0, totalDuration: 0, slowCount: 0 }
    existing.count++
    existing.totalDuration += metric.duration
    if (metric.duration > PERFORMANCE_THRESHOLDS.DB_QUERY_MS) {
      existing.slowCount++
    }
    tableStats.set(table, existing)
  }

  return Array.from(tableStats.entries())
    .map(([table, stats]) => ({
      table,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      slowCount: stats.slowCount,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
}

/**
 * Get recent slow queries with full details
 */
export function getRecentSlowQueries(limit: number = 20): Array<{
  query: string
  duration: number
  table: string
  timestamp: Date
}> {
  return queryMetrics
    .filter((m) => m.duration > PERFORMANCE_THRESHOLDS.DB_QUERY_MS)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map((m) => ({
      query: m.query.substring(0, 200),
      duration: Math.round(m.duration),
      table: extractTableName(m.query) || 'unknown',
      timestamp: new Date(m.timestamp),
    }))
}

/**
 * Check if database performance is within thresholds
 */
export function isDatabaseHealthy(): {
  healthy: boolean
  issues: string[]
} {
  const summary = getQueryMetricsSummary()
  const issues: string[] = []

  // Check average query time
  if (summary.averageQueryTime > PERFORMANCE_THRESHOLDS.DB_QUERY_MS) {
    issues.push(
      `Average query time (${summary.averageQueryTime}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.DB_QUERY_MS}ms)`,
    )
  }

  // Check slow query ratio
  const slowRatio =
    summary.totalQueries > 0 ? (summary.slowQueries / summary.totalQueries) * 100 : 0
  if (slowRatio > 10) {
    issues.push(`Slow query ratio (${slowRatio.toFixed(1)}%) exceeds 10% threshold`)
  }

  return {
    healthy: issues.length === 0,
    issues,
  }
}
