import { z } from 'zod'
import { db, schema } from '../../utils/db'

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0)
})

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  checklistItems: z.array(checklistItemSchema).default([]),
  isActive: z.boolean().default(true)
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
      estimatedDuration: result.data.estimatedDuration,
      checklistItems: result.data.checklistItems,
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
