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

  const user = session.user
  const id = getRouterParam(event, 'id')
  const partId = getRouterParam(event, 'partId')

  if (!id || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Category ID and Part ID are required',
    })
  }

  // Verify category exists and belongs to org
  const category = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, id),
      eq(schema.assetCategories.organisationId, user.organisationId),
    ),
  })

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
    })
  }

  // Find the assignment
  const assignment = await db.query.assetCategoryParts.findFirst({
    where: and(
      eq(schema.assetCategoryParts.categoryId, id),
      eq(schema.assetCategoryParts.partId, partId),
    ),
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part assignment not found',
    })
  }

  // Delete
  await db.delete(schema.assetCategoryParts).where(eq(schema.assetCategoryParts.id, assignment.id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'asset_category_part',
    entityId: assignment.id,
    oldValues: {
      categoryId: id,
      partId: partId,
    },
  })

  return { success: true }
})
