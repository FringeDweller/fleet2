import { getFullSyncData } from '../../utils/offline-sync'
import { hasPermission, requireAuth } from '../../utils/permissions'

/**
 * GET /api/sync/full
 *
 * Returns full sync data for initial sync or cache reset.
 * Includes all assets, work orders, and parts for the organisation.
 *
 * Note: This endpoint returns only the entities the user has permission to view.
 * - Assets: requires assets:read permission
 * - Work Orders: requires work_orders:read permission
 * - Parts: requires parts:read permission
 *
 * REQ-702.1: Assets, work orders, and parts cached in IndexedDB
 * REQ-702.2: Data synced on app open (background) - initial sync uses this endpoint
 */
export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  // Get full sync data
  const fullData = await getFullSyncData(user.organisationId)

  // Filter entities based on user permissions
  const result = {
    syncedAt: fullData.syncedAt,
    assets: hasPermission(user.permissions, 'assets:read') ? fullData.assets : [],
    workOrders: hasPermission(user.permissions, 'work_orders:read') ? fullData.workOrders : [],
    parts: hasPermission(user.permissions, 'parts:read') ? fullData.parts : [],
  }

  // Add counts for client reference
  return {
    ...result,
    counts: {
      assets: result.assets.length,
      workOrders: result.workOrders.length,
      parts: result.parts.length,
    },
  }
})
