import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * List all inventory count sessions
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const status = query.status as string | undefined

  // Get all count sessions for the organisation
  const sessions = await db.query.inventoryCountSessions.findMany({
    where: (sessions, { eq, and }) =>
      and(
        eq(sessions.organisationId, session.user!.organisationId),
        status
          ? eq(sessions.status, status as 'in_progress' | 'completed' | 'cancelled')
          : undefined,
      ),
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
    },
    orderBy: (sessions) => [desc(sessions.startedAt)],
  })

  // Get item counts for each session
  const sessionsWithCounts = await Promise.all(
    sessions.map(async (s) => {
      const items = await db.query.inventoryCountItems.findMany({
        where: (items, { eq }) => eq(items.sessionId, s.id),
        columns: {
          id: true,
          status: true,
        },
      })

      return {
        ...s,
        itemsCount: items.length,
        pendingCount: items.filter((i) => i.status === 'pending').length,
        countedCount: items.filter((i) => i.status === 'counted').length,
        approvedCount: items.filter((i) => i.status === 'approved').length,
      }
    }),
  )

  return sessionsWithCounts
})
