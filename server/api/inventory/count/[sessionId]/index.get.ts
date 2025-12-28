import { eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

/**
 * Get inventory count session with items
 * REQ-606-AC-03: View discrepancies (system vs. counted)
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

  // Get the count session with items and related data
  const countSession = await db.query.inventoryCountSessions.findFirst({
    where: (sessions, { eq, and }) =>
      and(eq(sessions.id, sessionId), eq(sessions.organisationId, session.user!.organisationId)),
    with: {
      startedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      completedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      items: {
        with: {
          part: {
            columns: {
              id: true,
              sku: true,
              name: true,
              unit: true,
            },
          },
          adjustedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: (items, { asc }) => [asc(items.createdAt)],
      },
    },
  })

  if (!countSession) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inventory count session not found',
    })
  }

  // Calculate summary stats
  const stats = {
    total: countSession.items.length,
    pending: countSession.items.filter((i) => i.status === 'pending').length,
    counted: countSession.items.filter((i) => i.status === 'counted').length,
    approved: countSession.items.filter((i) => i.status === 'approved').length,
    rejected: countSession.items.filter((i) => i.status === 'rejected').length,
    totalDiscrepancy: countSession.items
      .filter((i) => i.discrepancy)
      .reduce((sum, i) => sum + parseFloat(i.discrepancy!), 0),
  }

  return {
    ...countSession,
    stats,
  }
})
