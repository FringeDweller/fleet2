import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and, sql } from 'drizzle-orm'

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

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: z.enum(['entry', 'intermediate', 'advanced', 'expert']).optional().nullable(),
  checklistItems: z.array(checklistItemSchema).optional(),
  requiredParts: z.array(requiredPartSchema).optional(),
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

  // Check if checklist items changed to increment version
  const checklistChanged = result.data.checklistItems !== undefined
    && JSON.stringify(result.data.checklistItems) !== JSON.stringify(existing.checklistItems)
  const partsChanged = result.data.requiredParts !== undefined
    && JSON.stringify(result.data.requiredParts) !== JSON.stringify(existing.requiredParts)

  const updateData: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (result.data.name !== undefined) updateData.name = result.data.name
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.category !== undefined) updateData.category = result.data.category
  if (result.data.estimatedDuration !== undefined) updateData.estimatedDuration = result.data.estimatedDuration
  if (result.data.estimatedCost !== undefined) updateData.estimatedCost = result.data.estimatedCost?.toString()
  if (result.data.skillLevel !== undefined) updateData.skillLevel = result.data.skillLevel
  if (result.data.checklistItems !== undefined) updateData.checklistItems = result.data.checklistItems
  if (result.data.requiredParts !== undefined) updateData.requiredParts = result.data.requiredParts
  if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive

  // Increment version if checklist or parts changed
  if (checklistChanged || partsChanged) {
    updateData.version = sql`${schema.taskTemplates.version} + 1`
  }

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
