import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

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
      statusMessage: 'Category ID is required',
    })
  }

  // Verify category exists and belongs to org
  const category = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, id),
      eq(schema.assetCategories.organisationId, session.user.organisationId),
    ),
  })

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
    })
  }

  // Get parts assigned to this category
  const categoryParts = await db.query.assetCategoryParts.findMany({
    where: eq(schema.assetCategoryParts.categoryId, id),
    with: {
      part: {
        with: {
          category: true,
        },
      },
    },
  })

  return {
    data: categoryParts.map((cp) => ({
      id: cp.id,
      partId: cp.part.id,
      part: cp.part,
      notes: cp.notes,
      createdAt: cp.createdAt,
    })),
    category: {
      id: category.id,
      name: category.name,
    },
  }
})
