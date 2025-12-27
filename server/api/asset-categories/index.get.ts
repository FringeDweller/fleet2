import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const categories = await db.query.assetCategories.findMany({
    where: and(
      eq(schema.assetCategories.organisationId, session.user.organisationId),
      eq(schema.assetCategories.isActive, true),
    ),
    orderBy: (categories, { asc }) => [asc(categories.name)],
  })

  return categories
})
