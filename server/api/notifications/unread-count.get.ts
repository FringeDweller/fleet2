import { db, schema } from '../../utils/db'
import { eq, and, sql } from 'drizzle-orm'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(
      and(eq(schema.notifications.userId, session.user.id), eq(schema.notifications.isRead, false))
    )

  return { count: result[0]?.count ?? 0 }
})
