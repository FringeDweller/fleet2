import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['pass_fail', 'numeric', 'text', 'photo', 'signature']),
  required: z.boolean().default(true),
  order: z.number().int().min(0),
  category: z.string().max(100).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  unit: z.string().max(50).optional(),
})

const createTemplateSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  checklistItems: z.array(checklistItemSchema).default([]),
  isActive: z.boolean().default(true),
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

  const body = await readBody(event)
  const result = createTemplateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify category belongs to organisation if provided
  if (result.data.categoryId) {
    const category = await db.query.assetCategories.findFirst({
      where: and(
        eq(schema.assetCategories.id, result.data.categoryId),
        eq(schema.assetCategories.organisationId, user.organisationId),
      ),
    })

    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Asset category not found',
      })
    }
  }

  // Create the inspection template
  const [template] = await db
    .insert(schema.inspectionTemplates)
    .values({
      organisationId: user.organisationId,
      categoryId: result.data.categoryId,
      name: result.data.name,
      description: result.data.description,
      checklistItems: result.data.checklistItems,
      isActive: result.data.isActive,
    })
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'inspection_template',
    entityId: template!.id,
    newValues: template,
  })

  return template
})
