import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const receiveSchema = z.object({
  quantity: z.number().positive(),
  notes: z.string().optional(),
  clearOnOrder: z.boolean().default(true),
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

  const partId = getRouterParam(event, 'id')

  if (!partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part ID is required',
    })
  }

  const body = await readBody(event)
  const result = receiveSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify part exists and belongs to organisation
  const existingPart = await db.query.parts.findFirst({
    where: and(eq(schema.parts.id, partId), eq(schema.parts.organisationId, user.organisationId)),
  })

  if (!existingPart) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  const previousQuantity = Number.parseFloat(existingPart.quantityInStock)
  const receivedQuantity = result.data.quantity
  const newQuantity = previousQuantity + receivedQuantity

  const now = new Date()

  // Update part in transaction
  const [updated] = await db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      quantityInStock: newQuantity.toFixed(2),
      updatedAt: now,
    }

    if (result.data.clearOnOrder) {
      updateData.onOrderQuantity = '0'
      updateData.onOrderDate = null
      updateData.onOrderNotes = null
    }

    const [updatedPart] = await tx
      .update(schema.parts)
      .set(updateData)
      .where(and(eq(schema.parts.id, partId), eq(schema.parts.organisationId, user.organisationId)))
      .returning()

    // Create usage history record
    await tx.insert(schema.partUsageHistory).values({
      partId,
      usageType: 'adjustment',
      quantityChange: receivedQuantity.toFixed(2),
      previousQuantity: previousQuantity.toFixed(2),
      newQuantity: newQuantity.toFixed(2),
      unitCostAtTime: existingPart.unitCost,
      notes: result.data.notes || 'Stock received',
      userId: user.id,
    })

    return [updatedPart]
  })

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'receive_stock',
    entityType: 'part',
    entityId: partId,
    oldValues: {
      quantityInStock: existingPart.quantityInStock,
      onOrderQuantity: existingPart.onOrderQuantity,
    },
    newValues: {
      quantityInStock: updated!.quantityInStock,
      receivedQuantity,
      onOrderQuantity: updated!.onOrderQuantity,
    },
  })

  return updated
})
