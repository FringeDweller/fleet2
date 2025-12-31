/**
 * US-18.1.*: Performance Monitoring Endpoint
 *
 * Returns performance metrics for monitoring dashboard.
 * Only accessible to super_admin users.
 */

import { getMetricsSummary } from '../../utils/performance'
import { requireSuperAdmin } from '../../utils/permissions'
import { getQueryMetricsSummary, getSlowQueryStats } from '../../utils/query-monitor'

export default defineEventHandler(async (event) => {
  // Require super_admin role
  await requireSuperAdmin(event)

  // Get API response metrics
  const apiMetrics = getMetricsSummary()

  // Get database query metrics
  const queryMetrics = getQueryMetricsSummary()
  const slowQueries = getSlowQueryStats()

  // Get system memory info (if available)
  let memoryInfo = null
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage()
    memoryInfo = {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024),
    }
  }

  return {
    timestamp: new Date().toISOString(),
    api: {
      totalRequests: apiMetrics.totalRequests,
      averageResponseTime: apiMetrics.averageResponseTime,
      slowRequests: apiMetrics.slowRequests,
      slowRequestPercentage:
        apiMetrics.totalRequests > 0
          ? Math.round((apiMetrics.slowRequests / apiMetrics.totalRequests) * 100)
          : 0,
      slowestEndpoints: apiMetrics.slowestEndpoints.slice(0, 5),
    },
    database: {
      totalQueries: queryMetrics.totalQueries,
      averageQueryTime: queryMetrics.averageQueryTime,
      slowQueries: queryMetrics.slowQueries,
      queryDistribution: queryMetrics.queryDistribution,
      topSlowQueries: slowQueries.slice(0, 5).map((q) => ({
        query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
        count: q.count,
        avgDuration: q.avgDuration,
      })),
    },
    memory: memoryInfo,
    thresholds: {
      apiResponseMs: 200,
      dbQueryMs: 100,
      pageLoadMs: 2000,
    },
  }
})
