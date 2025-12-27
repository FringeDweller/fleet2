import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const addPartSchema = z.object({
  partId: z.string().uuid(),
  notes: z.string().optional(),
})

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

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Category ID is required',
    })
  }

  const body = await readBody(event)
  const result = addPartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
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

  // Verify part exists and belongs to org
  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, result.data.partId),
      eq(schema.parts.organisationId, user.organisationId),
    ),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Check if already exists
  const existing = await db.query.assetCategoryParts.findFirst({
    where: and(
      eq(schema.assetCategoryParts.categoryId, id),
      eq(schema.assetCategoryParts.partId, result.data.partId),
    ),
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Part is already assigned to this category',
    })
  }

  // Insert
  const inserted = await db
    .insert(schema.assetCategoryParts)
    .values({
      categoryId: id,
      partId: result.data.partId,
      notes: result.data.notes,
    })
    .returning()

  const record = inserted[0]!

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'asset_category_part',
    entityId: record.id,
    newValues: {
      categoryId: id,
      partId: result.data.partId,
    },
  })

  return record
})
