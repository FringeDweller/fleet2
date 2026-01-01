import { eq } from 'drizzle-orm'
import { defaultNotificationPreferences } from '../../../db/schema/notification-preferences'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/user/notification-preferences
 *
 * Get the current user's notification preferences.
 * Returns default preferences if none have been set.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  // Get existing preferences
  const preferences = await db.query.notificationPreferences.findFirst({
    where: eq(schema.notificationPreferences.userId, user.id),
  })

  if (preferences) {
    return preferences
  }

  // Return default preferences if none exist
  return {
    id: null,
    userId: user.id,
    organisationId: user.organisationId,
    ...defaultNotificationPreferences,
    createdAt: null,
    updatedAt: null,
  }
})
