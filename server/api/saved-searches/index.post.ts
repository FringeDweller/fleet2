import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  entity: z.enum(['asset', 'work_order']).default('asset'),
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
  }),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false)
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
  const result = createSavedSearchSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const { name, description, entity, filters, isDefault, isShared } = result.data

  // If setting as default, unset any existing default for this entity
  if (isDefault) {
    await db
      .update(schema.savedSearches)
      .set({ isDefault: false })
      .where(
        and(
          eq(schema.savedSearches.organisationId, session.user.organisationId),
          eq(schema.savedSearches.userId, session.user.id),
          eq(schema.savedSearches.entity, entity),
          eq(schema.savedSearches.isDefault, true)
        )
      )
  }

  const [savedSearch] = await db
    .insert(schema.savedSearches)
    .values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      name,
      description,
      entity,
      filters,
      isDefault,
      isShared
    })
    .returning()

  if (!savedSearch) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create saved search'
    })
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'saved_search',
    entityId: savedSearch.id,
    newValues: { name, entity, filters, isShared }
  })

  return savedSearch
})
