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

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Category ID is required',
    })
  }

  // Verify category exists and belongs to org
  const existing = await db.query.partCategories.findFirst({
    where: and(
      eq(schema.partCategories.id, id),
      eq(schema.partCategories.organisationId, session.user.organisationId),
    ),
    with: {
      children: true,
      parts: {
        where: eq(schema.parts.isActive, true),
        limit: 1,
      },
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
    })
  }

  // Check if category has children
  if (existing.children && existing.children.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete category with sub-categories',
    })
  }

  // Check if category has parts
  if (existing.parts && existing.parts.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete category with parts. Move or delete parts first.',
    })
  }

  // Soft delete by setting isActive to false
  await db
    .update(schema.partCategories)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.partCategories.id, id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'part_category',
    entityId: id,
    oldValues: { name: existing.name },
  })

  return { success: true }
})
