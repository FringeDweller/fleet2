import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const updatePartSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be positive').optional(),
  notes: z.string().max(500).optional().nullable(),
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
  const partId = getRouterParam(event, 'partId')

  if (!templateId || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID and Part ID are required',
    })
  }

  const body = await readBody(event)
  const result = updatePartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify template exists and belongs to organisation
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Get existing template part
  const existingPart = await db.query.taskTemplateParts.findFirst({
    where: and(
      eq(schema.taskTemplateParts.id, partId),
      eq(schema.taskTemplateParts.templateId, templateId),
    ),
    with: {
      part: true,
    },
  })

  if (!existingPart) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template part not found',
    })
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.quantity !== undefined) {
    updateValues.quantity = result.data.quantity.toString()
  }

  if (result.data.notes !== undefined) {
    updateValues.notes = result.data.notes
  }

  // Update the template part
  const [updatedPart] = await db
    .update(schema.taskTemplateParts)
    .set(updateValues)
    .where(eq(schema.taskTemplateParts.id, partId))
    .returning()

  if (!updatedPart) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update template part',
    })
  }

  // Log the action
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'task_template_part',
    entityId: partId,
    oldValues: {
      quantity: existingPart.quantity,
      notes: existingPart.notes,
    },
    newValues: {
      quantity: updatedPart.quantity,
      notes: updatedPart.notes,
    },
  })

  // Return with part details
  const unitCost = existingPart.part.unitCost ? parseFloat(existingPart.part.unitCost) : 0
  const quantity = parseFloat(updatedPart.quantity)

  return {
    ...updatedPart,
    part: {
      id: existingPart.part.id,
      sku: existingPart.part.sku,
      name: existingPart.part.name,
      unit: existingPart.part.unit,
      unitCost: existingPart.part.unitCost,
      quantityInStock: existingPart.part.quantityInStock,
    },
    lineCost: (unitCost * quantity).toFixed(2),
    inStock: parseFloat(existingPart.part.quantityInStock) >= quantity,
  }
})
