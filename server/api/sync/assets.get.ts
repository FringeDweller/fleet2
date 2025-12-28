import { z } from 'zod'
import { getModifiedAssets } from '../../utils/offline-sync'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
})

/**
 * GET /api/sync/assets
 *
 * Returns assets modified since the provided timestamp.
 * Used for incremental sync of assets to client-side IndexedDB cache.
 *
 * Query Parameters:
 * - since: ISO 8601 timestamp (optional) - only return assets modified after this time
 * - limit: number (optional, default 500, max 1000) - maximum records to return
 *
 * REQ-702.1: Assets cached in IndexedDB (client-side - this is the server sync endpoint)
 * REQ-702.4: All read operations work offline using cached data
 */
export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Validate query parameters
  const parsed = querySchema.safeParse({
    since: query.since,
    limit: query.limit,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    })
  }

  const { since, limit } = parsed.data
  const sinceDate = since ? new Date(since) : null

  const assets = await getModifiedAssets(user.organisationId, sinceDate, limit)

  const lastAsset = assets.at(-1)

  return {
    data: assets,
    syncedAt: new Date().toISOString(),
    hasMore: assets.length === limit,
    // Provide cursor for pagination if there are more results
    nextSince: lastAsset?.updatedAt ?? null,
  }
})
