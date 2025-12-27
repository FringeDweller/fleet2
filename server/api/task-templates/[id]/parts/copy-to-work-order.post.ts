import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const copyPartsSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
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
  const result = copyPartsSchema.safeParse(body)

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

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, result.data.workOrderId),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true, workOrderNumber: true, status: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Check if work order is in a valid state to add parts
  if (workOrder.status === 'closed' || workOrder.status === 'completed') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot add parts to a closed or completed work order',
    })
  }

  // Get template parts with part details
  const templateParts = await db.query.taskTemplateParts.findMany({
    where: eq(schema.taskTemplateParts.templateId, templateId),
    with: {
      part: true,
    },
  })

  if (templateParts.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template has no parts to copy',
    })
  }

  // Copy parts to work order
  const copiedParts = []

  for (const tp of templateParts) {
    const quantity = parseFloat(tp.quantity)
    const unitCost = tp.part.unitCost ? parseFloat(tp.part.unitCost) : 0
    const totalCost = unitCost * quantity

    const [workOrderPart] = await db
      .insert(schema.workOrderParts)
      .values({
        workOrderId: result.data.workOrderId,
        partName: tp.part.name,
        partNumber: tp.part.sku,
        quantity: Math.round(quantity),
        unitCost: tp.part.unitCost,
        totalCost: totalCost.toFixed(2),
        notes: tp.notes || `Copied from template: ${template.name}`,
        addedById: session.user.id,
      })
      .returning()

    if (workOrderPart) {
      copiedParts.push({
        ...workOrderPart,
        sourcePartId: tp.part.id,
        inStock: parseFloat(tp.part.quantityInStock) >= quantity,
      })
    }
  }

  // Log the action
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'execute',
    entityType: 'task_template_part',
    entityId: templateId,
    newValues: {
      action: 'copy_to_work_order',
      templateId,
      templateName: template.name,
      workOrderId: result.data.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      partsCount: copiedParts.length,
    },
  })

  // Calculate totals
  const totalCost = copiedParts.reduce((sum, p) => sum + (parseFloat(p.totalCost || '0') || 0), 0)

  return {
    success: true,
    workOrderId: result.data.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    partsCount: copiedParts.length,
    totalCost: totalCost.toFixed(2),
    parts: copiedParts,
  }
})
