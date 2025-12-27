import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { eq, and } from 'drizzle-orm'

const updatePartSchema = z.object({
  partName: z.string().min(1).max(200).optional(),
  partNumber: z.string().max(100).optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unitCost: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable()
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
  const partId = getRouterParam(event, 'partId')

  if (!id || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID and part ID are required'
    })
  }

  const body = await readBody(event)
  const result = updatePartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId)
    ),
    columns: { id: true }
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found'
    })
  }

  // Get existing part
  const existing = await db.query.workOrderParts.findFirst({
    where: and(eq(schema.workOrderParts.id, partId), eq(schema.workOrderParts.workOrderId, id))
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found'
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (result.data.partName !== undefined) updateData.partName = result.data.partName
  if (result.data.partNumber !== undefined) updateData.partNumber = result.data.partNumber
  if (result.data.notes !== undefined) updateData.notes = result.data.notes

  // Handle quantity/cost updates - recalculate total
  const quantity = result.data.quantity ?? existing.quantity
  const unitCost
    = result.data.unitCost !== undefined
      ? result.data.unitCost
      : existing.unitCost
        ? parseFloat(existing.unitCost)
        : null

  if (result.data.quantity !== undefined) updateData.quantity = quantity
  if (result.data.unitCost !== undefined) {
    updateData.unitCost = unitCost?.toFixed(2) ?? null
  }

  // Recalculate total cost if quantity or unit cost changed
  if (result.data.quantity !== undefined || result.data.unitCost !== undefined) {
    updateData.totalCost = unitCost ? (unitCost * quantity).toFixed(2) : null
  }

  const [part] = await db
    .update(schema.workOrderParts)
    .set(updateData)
    .where(and(eq(schema.workOrderParts.id, partId), eq(schema.workOrderParts.workOrderId, id)))
    .returning()

  if (!part) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update part'
    })
  }

  return part
})
