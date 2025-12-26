import { db, schema } from '../../utils/db'
import { eq, and, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const unreadOnly = query.unreadOnly === 'true'

  const conditions = [
    eq(schema.notifications.userId, session.user.id),
    eq(schema.notifications.organisationId, session.user.organisationId)
  ]

  if (unreadOnly) {
    conditions.push(eq(schema.notifications.isRead, false))
  }

  const notifications = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.notifications.createdAt)],
    limit
  })

  return notifications
})
