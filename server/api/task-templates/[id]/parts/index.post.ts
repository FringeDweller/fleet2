import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const addPartSchema = z.object({
  partId: z.string().uuid('Invalid part ID'),
  quantity: z.coerce.number().positive('Quantity must be positive').default(1),
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

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  const body = await readBody(event)
  const result = addPartSchema.safeParse(body)

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
    columns: { id: true, name: true },
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Verify part exists and belongs to same organisation
  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, result.data.partId),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Check if part is already added to template
  const existingLink = await db.query.taskTemplateParts.findFirst({
    where: and(
      eq(schema.taskTemplateParts.templateId, templateId),
      eq(schema.taskTemplateParts.partId, result.data.partId),
    ),
  })

  if (existingLink) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Part is already added to this template',
    })
  }

  // Add part to template
  const [templatePart] = await db
    .insert(schema.taskTemplateParts)
    .values({
      templateId,
      partId: result.data.partId,
      quantity: result.data.quantity.toString(),
      notes: result.data.notes,
    })
    .returning()

  if (!templatePart) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add part to template',
    })
  }

  // Log the action
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'task_template_part',
    entityId: templatePart.id,
    newValues: {
      templateId,
      templateName: template.name,
      partId: part.id,
      partName: part.name,
      quantity: result.data.quantity,
    },
  })

  // Return with part details
  const unitCost = part.unitCost ? parseFloat(part.unitCost) : 0
  const quantity = parseFloat(templatePart.quantity)

  return {
    ...templatePart,
    part: {
      id: part.id,
      sku: part.sku,
      name: part.name,
      unit: part.unit,
      unitCost: part.unitCost,
      quantityInStock: part.quantityInStock,
    },
    lineCost: (unitCost * quantity).toFixed(2),
    inStock: parseFloat(part.quantityInStock) >= quantity,
  }
})
