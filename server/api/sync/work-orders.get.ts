import { z } from 'zod'
import { getModifiedWorkOrders } from '../../utils/offline-sync'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
})

/**
 * GET /api/sync/work-orders
 *
 * Returns work orders modified since the provided timestamp.
 * Used for incremental sync of work orders to client-side IndexedDB cache.
 *
 * Query Parameters:
 * - since: ISO 8601 timestamp (optional) - only return work orders modified after this time
 * - limit: number (optional, default 500, max 1000) - maximum records to return
 *
 * REQ-702.1: Work orders cached in IndexedDB (client-side - this is the server sync endpoint)
 * REQ-702.4: All read operations work offline using cached data
 */
export default defineEventHandler(async (event) => {
  // Require work_orders:read permission
  const user = await requirePermission(event, 'work_orders:read')

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

  const workOrders = await getModifiedWorkOrders(user.organisationId, sinceDate, limit)

  const lastWorkOrder = workOrders.at(-1)

  return {
    data: workOrders,
    syncedAt: new Date().toISOString(),
    hasMore: workOrders.length === limit,
    // Provide cursor for pagination if there are more results
    nextSince: lastWorkOrder?.updatedAt ?? null,
  }
})
