import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  filters: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    yearMin: z.number().int().optional(),
    yearMax: z.number().int().optional(),
    mileageMin: z.number().optional(),
    mileageMax: z.number().optional(),
    hoursMin: z.number().optional(),
    hoursMax: z.number().optional(),
    includeArchived: z.boolean().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  }).optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional()
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
      statusMessage: 'Missing saved search ID'
    })
  }

  const body = await readBody(event)
  const result = updateSavedSearchSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Check if user owns this saved search
  const existing = await db.query.savedSearches.findFirst({
    where: and(
      eq(schema.savedSearches.id, id),
      eq(schema.savedSearches.organisationId, session.user.organisationId),
      eq(schema.savedSearches.userId, session.user.id)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved search not found or you do not have permission to edit it'
    })
  }

  const { name, description, filters, isDefault, isShared } = result.data

  // If setting as default, unset any existing default for this entity
  if (isDefault) {
    await db
      .update(schema.savedSearches)
      .set({ isDefault: false })
      .where(
        and(
          eq(schema.savedSearches.organisationId, session.user.organisationId),
          eq(schema.savedSearches.userId, session.user.id),
          eq(schema.savedSearches.entity, existing.entity),
          eq(schema.savedSearches.isDefault, true)
        )
      )
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (filters !== undefined) updateData.filters = filters
  if (isDefault !== undefined) updateData.isDefault = isDefault
  if (isShared !== undefined) updateData.isShared = isShared

  const [updated] = await db
    .update(schema.savedSearches)
    .set(updateData)
    .where(eq(schema.savedSearches.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'saved_search',
    entityId: id,
    oldValues: { name: existing.name, filters: existing.filters, isShared: existing.isShared },
    newValues: updateData
  })

  return updated
})
