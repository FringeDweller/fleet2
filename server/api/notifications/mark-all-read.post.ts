import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  await db
    .update(schema.notifications)
    .set({
      isRead: true,
      readAt: new Date()
    })
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        eq(schema.notifications.isRead, false)
      )
    )

  return { success: true }
})
