import { z } from 'zod'
import { db, schema } from '../../utils/db'

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0)
})

const requiredPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional()
})

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: z.enum(['entry', 'intermediate', 'advanced', 'expert']).optional().nullable(),
  checklistItems: z.array(checklistItemSchema).default([]),
  requiredParts: z.array(requiredPartSchema).default([]),
  isActive: z.boolean().default(true)
})

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createTemplateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const [template] = await db
    .insert(schema.taskTemplates)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      category: result.data.category,
      estimatedDuration: result.data.estimatedDuration,
      estimatedCost: result.data.estimatedCost?.toString(),
      skillLevel: result.data.skillLevel,
      checklistItems: result.data.checklistItems,
      requiredParts: result.data.requiredParts,
      isActive: result.data.isActive
    })
    .returning()

  if (!template) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create template'
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'task_template',
    entityId: template.id,
    newValues: template
  })

  return template
})
