import { and, eq, sql } from 'drizzle-orm'
import { CacheTTL, cachedFetch, cacheKey } from '../../utils/cache'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const userId = session.user.id

  // US-18.1.1: Short cache for notification count (frequently polled)
  // TTL: 30 seconds to balance freshness with performance
  const key = cacheKey('COUNT', 'notifications-unread', userId, {})

  const count = await cachedFetch(
    key,
    async () => {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false)))

      return result[0]?.count ?? 0
    },
    { ttl: CacheTTL.SHORT },
  )

  return { count }
})
