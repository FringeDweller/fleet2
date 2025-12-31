import { and, eq } from 'drizzle-orm'
import { cacheKey } from '../../utils/cache'
import { db, schema } from '../../utils/db'
import { cache } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  await db
    .update(schema.notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(eq(schema.notifications.userId, session.user.id), eq(schema.notifications.isRead, false)),
    )

  // US-18.1.1: Invalidate unread count cache
  const countKey = cacheKey('COUNT', 'notifications-unread', session.user.id, {})
  await cache.del(countKey)

  return { success: true }
})
