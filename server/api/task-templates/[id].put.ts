import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0)
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  checklistItems: z.array(checklistItemSchema).optional(),
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
      statusMessage: 'Template ID is required'
    })
  }

  const body = await readBody(event)
  const result = updateTemplateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Get existing template for audit log
  const existing = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, id),
      eq(schema.taskTemplates.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found'
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (result.data.name !== undefined) updateData.name = result.data.name
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.estimatedDuration !== undefined) updateData.estimatedDuration = result.data.estimatedDuration
  if (result.data.checklistItems !== undefined) updateData.checklistItems = result.data.checklistItems
  if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive

  const [template] = await db
    .update(schema.taskTemplates)
    .set(updateData)
    .where(
      and(
        eq(schema.taskTemplates.id, id),
        eq(schema.taskTemplates.organisationId, session.user.organisationId)
      )
    )
    .returning()

  if (!template) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update template'
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'task_template',
    entityId: template.id,
    oldValues: existing,
    newValues: template
  })

  return template
})
