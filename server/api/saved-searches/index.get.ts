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

  const query = getQuery(event)
  const entity = query.entity as 'asset' | 'work_order' | undefined

  const conditions = [
    eq(schema.savedSearches.organisationId, session.user.organisationId),
    or(eq(schema.savedSearches.userId, session.user.id), eq(schema.savedSearches.isShared, true))!,
  ]

  if (entity && ['asset', 'work_order'].includes(entity)) {
    conditions.push(eq(schema.savedSearches.entity, entity))
  }

  const savedSearches = await db.query.savedSearches.findMany({
    where: and(...conditions),
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
    orderBy: (searches, { desc }) => [desc(searches.createdAt)],
  })

  return savedSearches
})
