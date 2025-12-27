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

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing category ID'
    })
  }

  const category = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, id),
      eq(schema.assetCategories.organisationId, session.user.organisationId)
    ),
    with: {
      parent: true,
      children: {
        where: eq(schema.assetCategories.isActive, true),
        orderBy: (categories, { asc }) => [asc(categories.name)]
      },
      assets: {
        where: eq(schema.assets.isArchived, false),
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true
        },
        limit: 10
      }
    }
  })

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found'
    })
  }

  return category
})
