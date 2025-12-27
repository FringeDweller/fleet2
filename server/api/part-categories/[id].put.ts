import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional()
})

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
      statusMessage: 'Category ID is required'
    })
  }

  const body = await readBody(event)
  const result = updateCategorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify category exists and belongs to org
  const existing = await db.query.partCategories.findFirst({
    where: and(
      eq(schema.partCategories.id, id),
      eq(schema.partCategories.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found'
    })
  }

  // Verify parent exists if provided
  if (result.data.parentId) {
    // Prevent setting self as parent
    if (result.data.parentId === id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category cannot be its own parent'
      })
    }

    const parent = await db.query.partCategories.findFirst({
      where: and(
        eq(schema.partCategories.id, result.data.parentId),
        eq(schema.partCategories.organisationId, session.user.organisationId)
      )
    })

    if (!parent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Parent category not found'
      })
    }
  }

  const [updated] = await db
    .update(schema.partCategories)
    .set({
      ...result.data,
      updatedAt: new Date()
    })
    .where(eq(schema.partCategories.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'part_category',
    entityId: id,
    oldValues: { name: existing.name, parentId: existing.parentId },
    newValues: result.data
  })

  return updated
})
