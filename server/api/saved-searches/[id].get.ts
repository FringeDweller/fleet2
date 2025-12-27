import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

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
      statusMessage: 'Missing saved search ID',
    })
  }

  const savedSearch = await db.query.savedSearches.findFirst({
    where: and(
      eq(schema.savedSearches.id, id),
      eq(schema.savedSearches.organisationId, session.user.organisationId),
      or(eq(schema.savedSearches.userId, session.user.id), eq(schema.savedSearches.isShared, true)),
    ),
    with: {
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  if (!savedSearch) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved search not found',
    })
  }

  return savedSearch
})
