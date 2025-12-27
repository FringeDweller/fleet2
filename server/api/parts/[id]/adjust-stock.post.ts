import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { eq, and } from 'drizzle-orm'

const adjustStockSchema = z.object({
  usageType: z.enum(['adjustment', 'restock', 'return', 'damaged', 'expired']),
  quantityChange: z.number().refine(val => val !== 0, 'Quantity change cannot be zero'),
  notes: z.string().optional(),
  reference: z.string().max(200).optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = session.user

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part ID is required'
    })
  }

  const body = await readBody(event)
  const result = adjustStockSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify part exists and belongs to org
  const part = await db.query.parts.findFirst({
    where: and(eq(schema.parts.id, id), eq(schema.parts.organisationId, user.organisationId))
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found'
    })
  }

  const previousQuantity = parseFloat(part.quantityInStock)
  const newQuantity = previousQuantity + result.data.quantityChange

  if (newQuantity < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot reduce stock below zero'
    })
  }

  // Update part quantity and record history in a transaction
  await db.transaction(async (tx) => {
    // Update part stock
    await tx
      .update(schema.parts)
      .set({
        quantityInStock: newQuantity.toString(),
        updatedAt: new Date()
      })
      .where(eq(schema.parts.id, id))

    // Record usage history
    await tx.insert(schema.partUsageHistory).values({
      partId: id,
      usageType: result.data.usageType,
      quantityChange: result.data.quantityChange.toString(),
      previousQuantity: previousQuantity.toString(),
      newQuantity: newQuantity.toString(),
      unitCostAtTime: part.unitCost,
      notes: result.data.notes,
      reference: result.data.reference,
      userId: user.id
    })
  })

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'part',
    entityId: id,
    oldValues: { quantityInStock: previousQuantity },
    newValues: {
      quantityInStock: newQuantity,
      adjustmentType: result.data.usageType,
      adjustmentAmount: result.data.quantityChange
    }
  })

  // Fetch updated part
  const updated = await db.query.parts.findFirst({
    where: eq(schema.parts.id, id),
    with: { category: true }
  })

  return updated
})
