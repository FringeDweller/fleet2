import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createCategorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify parent exists and belongs to org if provided
  if (result.data.parentId) {
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

  const [category] = await db
    .insert(schema.partCategories)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId
    })
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'part_category',
    entityId: category!.id,
    newValues: { name: result.data.name, parentId: result.data.parentId }
  })

  return category
})
