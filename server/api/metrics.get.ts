/**
 * Prometheus Metrics Endpoint
 *
 * Exposes application metrics in Prometheus format for scraping.
 *
 * NOTE: This implementation uses a pattern compatible with prom-client,
 * but does not require the library to be installed. The metrics are
 * collected from the Node.js runtime and application state.
 *
 * To use full prom-client features, install it:
 *   bun add prom-client
 *
 * Then replace the manual metrics below with prom-client collectors.
 */

import { sql } from 'drizzle-orm'
import { db } from '../utils/db'

interface MetricLabel {
  name: string
  value: string
}

interface Metric {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  help: string
  labels?: MetricLabel[]
  value: number
  buckets?: { le: string; count: number }[]
}

// In-memory metrics store (would be replaced by prom-client Registry in production)
// These would typically be collected by middleware
const requestMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  requestDurations: [] as number[],
}

// Collect database connection stats
async function getDbConnectionStats(): Promise<{ active: number; idle: number }> {
  try {
    // Query pg_stat_activity for connection stats
    const result = await db.execute<{ active: number; idle: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `)
    const row = result[0]
    return {
      active: Number(row?.active) || 0,
      idle: Number(row?.idle) || 0,
    }
  } catch {
    return { active: 0, idle: 0 }
  }
}

// Format metrics in Prometheus exposition format
function formatPrometheusMetrics(metrics: Metric[]): string {
  const lines: string[] = []

  for (const metric of metrics) {
    // Add HELP and TYPE
    lines.push(`# HELP ${metric.name} ${metric.help}`)
    lines.push(`# TYPE ${metric.name} ${metric.type}`)

    if (metric.type === 'histogram' && metric.buckets) {
      // Format histogram buckets
      for (const bucket of metric.buckets) {
        const labelStr = metric.labels
          ? `${metric.labels.map((l) => `${l.name}="${l.value}"`).join(',')},le="${bucket.le}"`
          : `le="${bucket.le}"`
        lines.push(`${metric.name}_bucket{${labelStr}} ${bucket.count}`)
      }
      // Add sum and count
      const labelStr = metric.labels
        ? `{${metric.labels.map((l) => `${l.name}="${l.value}"`).join(',')}}`
        : ''
      lines.push(`${metric.name}_sum${labelStr} ${metric.value}`)
      lines.push(
        `${metric.name}_count${labelStr} ${metric.buckets[metric.buckets.length - 1]?.count || 0}`,
      )
    } else {
      // Format counter/gauge
      const labelStr = metric.labels
        ? `{${metric.labels.map((l) => `${l.name}="${l.value}"`).join(',')}}`
        : ''
      lines.push(`${metric.name}${labelStr} ${metric.value}`)
    }

    lines.push('') // Empty line between metrics
  }

  return lines.join('\n')
}

// Calculate histogram buckets from duration samples
function calculateHistogramBuckets(
  durations: number[],
  bucketBoundaries: number[],
): { le: string; count: number }[] {
  const buckets: { le: string; count: number }[] = []
  let cumulativeCount = 0

  for (const boundary of bucketBoundaries) {
    const count = durations.filter((d) => d <= boundary).length
    cumulativeCount = count
    buckets.push({ le: boundary.toString(), count: cumulativeCount })
  }

  // Add +Inf bucket
  buckets.push({ le: '+Inf', count: durations.length })

  return buckets
}

export default defineEventHandler(async (event) => {
  // Optional: Add authentication for metrics endpoint
  // const authHeader = getHeader(event, 'authorization')
  // if (authHeader !== `Bearer ${process.env.METRICS_AUTH_TOKEN}`) {
  //   throw createError({ statusCode: 401, message: 'Unauthorized' })
  // }

  // Collect all metrics
  const metrics: Metric[] = []

  // Process metrics
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()

  // Node.js heap size
  metrics.push({
    name: 'nodejs_heap_size_total_bytes',
    type: 'gauge',
    help: 'Total heap size in bytes',
    value: memoryUsage.heapTotal,
  })

  metrics.push({
    name: 'nodejs_heap_size_used_bytes',
    type: 'gauge',
    help: 'Used heap size in bytes',
    value: memoryUsage.heapUsed,
  })

  metrics.push({
    name: 'nodejs_external_memory_bytes',
    type: 'gauge',
    help: 'External memory usage in bytes',
    value: memoryUsage.external,
  })

  metrics.push({
    name: 'nodejs_rss_bytes',
    type: 'gauge',
    help: 'Resident set size in bytes',
    value: memoryUsage.rss,
  })

  // Process CPU
  metrics.push({
    name: 'process_cpu_user_seconds_total',
    type: 'counter',
    help: 'User CPU time spent in seconds',
    value: cpuUsage.user / 1e6, // Convert microseconds to seconds
  })

  metrics.push({
    name: 'process_cpu_system_seconds_total',
    type: 'counter',
    help: 'System CPU time spent in seconds',
    value: cpuUsage.system / 1e6,
  })

  // Process uptime
  metrics.push({
    name: 'process_start_time_seconds',
    type: 'gauge',
    help: 'Start time of the process since unix epoch in seconds',
    value: Math.floor(Date.now() / 1000 - process.uptime()),
  })

  metrics.push({
    name: 'process_uptime_seconds',
    type: 'gauge',
    help: 'Process uptime in seconds',
    value: Math.round(process.uptime() * 100) / 100,
  })

  // Database connection pool stats
  const dbStats = await getDbConnectionStats()

  metrics.push({
    name: 'db_connections_active',
    type: 'gauge',
    help: 'Number of active database connections',
    value: dbStats.active,
    labels: [{ name: 'app', value: 'fleet2' }],
  })

  metrics.push({
    name: 'db_connections_idle',
    type: 'gauge',
    help: 'Number of idle database connections',
    value: dbStats.idle,
    labels: [{ name: 'app', value: 'fleet2' }],
  })

  // Instance identifier
  const instanceId = process.env.INSTANCE_ID || 'unknown'

  metrics.push({
    name: 'fleet2_instance_info',
    type: 'gauge',
    help: 'Fleet2 instance information',
    value: 1,
    labels: [
      { name: 'instance', value: instanceId },
      { name: 'version', value: process.env.APP_VERSION || 'unknown' },
      { name: 'node_version', value: process.version },
    ],
  })

  // HTTP request metrics (placeholder - would be populated by middleware)
  // In production, use prom-client with middleware to collect these
  metrics.push({
    name: 'http_requests_total',
    type: 'counter',
    help: 'Total number of HTTP requests',
    value: requestMetrics.totalRequests,
    labels: [
      { name: 'app', value: 'fleet2' },
      { name: 'instance', value: instanceId },
    ],
  })

  metrics.push({
    name: 'http_request_errors_total',
    type: 'counter',
    help: 'Total number of HTTP request errors',
    value: requestMetrics.totalErrors,
    labels: [
      { name: 'app', value: 'fleet2' },
      { name: 'instance', value: instanceId },
    ],
  })

  // Request duration histogram
  const durationBuckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  const durationSum = requestMetrics.requestDurations.reduce((a, b) => a + b, 0)

  metrics.push({
    name: 'http_request_duration_seconds',
    type: 'histogram',
    help: 'HTTP request duration in seconds',
    value: durationSum,
    labels: [
      { name: 'app', value: 'fleet2' },
      { name: 'instance', value: instanceId },
    ],
    buckets: calculateHistogramBuckets(requestMetrics.requestDurations, durationBuckets),
  })

  // Event loop lag (approximation)
  const eventLoopStart = process.hrtime.bigint()
  await new Promise((resolve) => setImmediate(resolve))
  const eventLoopLag = Number(process.hrtime.bigint() - eventLoopStart) / 1e9 // Convert to seconds

  metrics.push({
    name: 'nodejs_eventloop_lag_seconds',
    type: 'gauge',
    help: 'Event loop lag in seconds',
    value: eventLoopLag,
  })

  // Active handles and requests (using Node.js internal methods)
  const activeHandles =
    (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.().length ||
    0
  const activeRequests =
    (process as unknown as { _getActiveRequests?: () => unknown[] })._getActiveRequests?.()
      .length || 0

  metrics.push({
    name: 'nodejs_active_handles_total',
    type: 'gauge',
    help: 'Number of active handles',
    value: activeHandles,
  })

  metrics.push({
    name: 'nodejs_active_requests_total',
    type: 'gauge',
    help: 'Number of active requests',
    value: activeRequests,
  })

  // Format and return
  const output = formatPrometheusMetrics(metrics)

  setHeader(event, 'Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  return output
})

/**
 * Example: Full prom-client integration
 *
 * If you install prom-client, you can replace the above with:
 *
 * ```typescript
 * import client from 'prom-client'
 *
 * // Create a registry
 * const register = new client.Registry()
 *
 * // Add default metrics
 * client.collectDefaultMetrics({ register })
 *
 * // Custom metrics
 * const httpRequestsTotal = new client.Counter({
 *   name: 'http_requests_total',
 *   help: 'Total number of HTTP requests',
 *   labelNames: ['method', 'path', 'status'],
 *   registers: [register],
 * })
 *
 * const httpRequestDuration = new client.Histogram({
 *   name: 'http_request_duration_seconds',
 *   help: 'HTTP request duration in seconds',
 *   labelNames: ['method', 'path'],
 *   buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
 *   registers: [register],
 * })
 *
 * // Export handler
 * export default defineEventHandler(async (event) => {
 *   const metrics = await register.metrics()
 *   setHeader(event, 'Content-Type', register.contentType)
 *   return metrics
 * })
 * ```
 */
