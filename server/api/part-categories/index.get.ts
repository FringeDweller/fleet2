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

  const categories = await db.query.partCategories.findMany({
    where: and(
      eq(schema.partCategories.organisationId, session.user.organisationId),
      eq(schema.partCategories.isActive, true)
    ),
    orderBy: (categories, { asc }) => [asc(categories.name)]
  })

  return categories
})
