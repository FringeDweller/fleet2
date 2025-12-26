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

  // Verify category exists and belongs to org
  const existing = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, id),
      eq(schema.assetCategories.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found'
    })
  }

  // Check if category has children
  const children = await db.query.assetCategories.findMany({
    where: and(
      eq(schema.assetCategories.parentId, id),
      eq(schema.assetCategories.isActive, true)
    ),
    columns: { id: true }
  })

  if (children.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete category with active subcategories. Please delete or reassign subcategories first.'
    })
  }

  // Check if category has assets
  const assets = await db.query.assets.findMany({
    where: and(
      eq(schema.assets.categoryId, id),
      eq(schema.assets.isArchived, false)
    ),
    columns: { id: true },
    limit: 1
  })

  if (assets.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete category with assigned assets. Please reassign assets first.'
    })
  }

  // Soft delete by setting isActive to false
  const [updated] = await db
    .update(schema.assetCategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(schema.assetCategories.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'asset_category',
    entityId: id,
    oldValues: { name: existing.name, isActive: true }
  })

  return { success: true, category: updated }
})
