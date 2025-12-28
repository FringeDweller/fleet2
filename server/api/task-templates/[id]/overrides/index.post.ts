import { and, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0),
})

const requiredPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

const createOverrideSchema = z
  .object({
    assetId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    partsOverride: z.array(requiredPartSchema).optional().nullable(),
    checklistOverride: z.array(checklistItemSchema).optional().nullable(),
    estimatedDurationOverride: z.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((data) => data.assetId || data.categoryId, {
    message: 'Either assetId or categoryId must be provided',
  })
  .refine((data) => !(data.assetId && data.categoryId), {
    message: 'Cannot specify both assetId and categoryId',
  })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const templateId = getRouterParam(event, 'id')

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  const body = await readBody(event)
  const result = createOverrideSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify the template exists and belongs to the organization
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Verify the asset or category exists and belongs to the organization
  if (result.data.assetId) {
    const asset = await db.query.assets.findFirst({
      where: and(
        eq(schema.assets.id, result.data.assetId),
        eq(schema.assets.organisationId, session.user.organisationId),
      ),
    })

    if (!asset) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Asset not found',
      })
    }
  }

  if (result.data.categoryId) {
    const category = await db.query.assetCategories.findFirst({
      where: and(
        eq(schema.assetCategories.id, result.data.categoryId),
        eq(schema.assetCategories.organisationId, session.user.organisationId),
      ),
    })

    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found',
      })
    }
  }

  // Check if an override already exists for this combination
  const existingOverride = await db.query.taskOverrides.findFirst({
    where: and(
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
      result.data.assetId
        ? eq(schema.taskOverrides.assetId, result.data.assetId)
        : eq(schema.taskOverrides.categoryId, result.data.categoryId as string),
    ),
  })

  if (existingOverride) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An override already exists for this asset/category',
    })
  }

  // Create the override
  const [override] = await db
    .insert(schema.taskOverrides)
    .values({
      organisationId: session.user.organisationId,
      taskTemplateId: templateId,
      assetId: result.data.assetId,
      categoryId: result.data.categoryId,
      partsOverride: result.data.partsOverride,
      checklistOverride: result.data.checklistOverride,
      estimatedDurationOverride: result.data.estimatedDurationOverride,
      notes: result.data.notes,
    })
    .returning()

  if (!override) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create override',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'task_override',
    entityId: override.id,
    newValues: override,
  })

  return override
})
