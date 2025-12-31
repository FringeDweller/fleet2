import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { cacheKey } from '../../utils/cache'
import { db, schema } from '../../utils/db'
import { cache } from '../../utils/redis'

const updateSchema = z.object({
  isRead: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing notification ID',
    })
  }

  const body = await readBody(event)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    })
  }

  const [updated] = await db
    .update(schema.notifications)
    .set({
      isRead: parsed.data.isRead,
      readAt: parsed.data.isRead ? new Date() : null,
    })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, session.user.id)))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notification not found',
    })
  }

  // US-18.1.1: Invalidate unread count cache
  const countKey = cacheKey('COUNT', 'notifications-unread', session.user.id, {})
  await cache.del(countKey)

  return updated
})
