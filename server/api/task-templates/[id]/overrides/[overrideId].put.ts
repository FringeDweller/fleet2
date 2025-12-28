import { and, eq } from 'drizzle-orm'
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

const updateOverrideSchema = z.object({
  partsOverride: z.array(requiredPartSchema).optional().nullable(),
  checklistOverride: z.array(checklistItemSchema).optional().nullable(),
  estimatedDurationOverride: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
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
  const overrideId = getRouterParam(event, 'overrideId')

  if (!templateId || !overrideId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID and Override ID are required',
    })
  }

  const body = await readBody(event)
  const result = updateOverrideSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify the override exists and belongs to the organization
  const existingOverride = await db.query.taskOverrides.findFirst({
    where: and(
      eq(schema.taskOverrides.id, overrideId),
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
    ),
  })

  if (!existingOverride) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Override not found',
    })
  }

  // Update the override
  const [updated] = await db
    .update(schema.taskOverrides)
    .set({
      partsOverride: result.data.partsOverride,
      checklistOverride: result.data.checklistOverride,
      estimatedDurationOverride: result.data.estimatedDurationOverride,
      notes: result.data.notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.taskOverrides.id, overrideId))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update override',
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'task_override',
    entityId: updated.id,
    oldValues: existingOverride,
    newValues: updated,
  })

  return updated
})
