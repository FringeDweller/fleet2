import { getSyncManifest } from '../../utils/offline-sync'
import { requireAuth } from '../../utils/permissions'

/**
 * GET /api/sync/manifest
 *
 * Returns sync manifest with last modified timestamps for each entity type.
 * Used by clients to determine which entities need to be synced.
 *
 * REQ-702.2: Data synced on app open (background)
 * REQ-702.5: Periodic refresh when online (configurable interval)
 */
export default defineEventHandler(async (event) => {
  // Require authentication - any authenticated user can sync
  const user = await requireAuth(event)

  const manifest = await getSyncManifest(user.organisationId)

  return manifest
})
