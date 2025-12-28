import { getFuelBackendClient } from '../../../utils/fuel-backend-client'
import { getIntegrationHealth, getSyncHistory } from '../../../utils/fuel-sync'
import { requirePermission } from '../../../utils/permissions'

/**
 * Get the health status of the fuel backend integration
 *
 * GET /api/fuel/integration/health
 *
 * Requires: settings:read permission
 *
 * Returns:
 * - configured: Whether the integration is configured
 * - status: Current health status (healthy, degraded, unhealthy, offline, unknown)
 * - lastSync: Timestamp of last successful sync
 * - lastError: Last error message if any
 * - stats: Sync statistics
 * - recentSyncs: Last 5 sync operations
 * - externalHealth: Health check result from external system (if configured)
 */
export default defineEventHandler(async (event) => {
  // Require settings:read permission
  const user = await requirePermission(event, 'settings:read')

  // Get integration health from database
  const health = await getIntegrationHealth(user.organisationId)

  if (!health) {
    return {
      configured: false,
      status: 'offline',
      message: 'Fuel backend integration not configured',
      lastSync: null,
      lastError: null,
      stats: {
        totalRecordsSynced: 0,
        consecutiveErrors: 0,
        totalSuccesses: 0,
        totalErrors: 0,
      },
      recentSyncs: [],
      externalHealth: null,
    }
  }

  // Get recent sync history
  const recentSyncs = await getSyncHistory(user.organisationId, 5)

  // If configured, check external system health
  let externalHealth = null
  if (health.configured) {
    const client = getFuelBackendClient()
    externalHealth = await client.checkHealth()
  }

  return {
    configured: health.configured,
    status: health.status,
    message: getStatusMessage(health.status, health.configured),
    lastSync: health.lastSync?.toISOString() || null,
    lastError: health.lastError,
    stats: health.stats,
    recentSyncs: recentSyncs.map((sync) => ({
      id: sync.id,
      syncType: sync.syncType,
      startedAt: sync.startedAt.toISOString(),
      completedAt: sync.completedAt?.toISOString() || null,
      success: sync.success,
      recordsCreated: sync.recordsCreated,
      discrepanciesFound: sync.discrepanciesFound,
      errorMessage: sync.errorMessage,
    })),
    externalHealth: externalHealth
      ? {
          healthy: externalHealth.healthy,
          status: externalHealth.status,
          responseTimeMs: externalHealth.responseTimeMs,
          version: externalHealth.version,
        }
      : null,
  }
})

function getStatusMessage(
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline' | 'unknown',
  configured: boolean,
): string {
  if (!configured) {
    return 'Integration not configured. Set FUEL_BACKEND_URL and FUEL_BACKEND_API_KEY environment variables.'
  }

  switch (status) {
    case 'healthy':
      return 'Integration is working normally.'
    case 'degraded':
      return 'Integration is experiencing issues. Some syncs may have failed.'
    case 'unhealthy':
      return 'Integration is failing. Multiple consecutive errors detected.'
    case 'offline':
      return 'Integration is offline. Cannot connect to external system.'
    case 'unknown':
      return 'Integration status unknown. No syncs have been performed yet.'
    default:
      return 'Unknown status.'
  }
}
