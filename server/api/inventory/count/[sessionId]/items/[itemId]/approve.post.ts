import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../../../utils/db'

const approveAdjustmentSchema = z.object({
  adjustmentReason: z.string().min(1, 'Adjustment reason is required'),
})

/**
 * Approve inventory count adjustment
 * REQ-606-AC-04: Approve adjustments
 * REQ-606-AC-05: Adjustments recorded with reason
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const sessionId = getRouterParam(event, 'sessionId')
  const itemId = getRouterParam(event, 'itemId')

  if (!sessionId || !itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID and Item ID are required',
    })
  }

  const body = await readBody(event)
  const result = approveAdjustmentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Verify the item belongs to the session
  const item = await db.query.inventoryCountItems.findFirst({
    where: (items, { eq, and }) => and(eq(items.id, itemId), eq(items.sessionId, sessionId)),
    with: {
      session: {
        columns: {
          organisationId: true,
          status: true,
        },
      },
    },
  })

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inventory count item not found',
    })
  }

  if (item.session.organisationId !== session.user.organisationId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  if (item.session.status !== 'in_progress') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot approve items for completed or cancelled sessions',
    })
  }

  if (item.status !== 'counted') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Can only approve counted items',
    })
  }

  // Update the item status to approved
  const [updated] = await db
    .update(schema.inventoryCountItems)
    .set({
      status: 'approved',
      adjustedAt: new Date(),
      adjustedById: session.user.id,
      adjustmentReason: data.adjustmentReason,
      updatedAt: new Date(),
    })
    .where(eq(schema.inventoryCountItems.id, itemId))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to approve adjustment',
    })
  }

  // Update the part's quantity in stock
  const newQuantity = updated.countedQuantity!
  await db
    .update(schema.parts)
    .set({
      quantityInStock: newQuantity,
      updatedAt: new Date(),
    })
    .where(eq(schema.parts.id, item.partId))

  // Record the adjustment in part usage history
  await db.insert(schema.partUsageHistory).values({
    partId: item.partId,
    usageType: 'adjustment',
    quantityChange: String(updated.discrepancy ?? 0),
    previousQuantity: String(item.systemQuantity ?? 0),
    newQuantity: String(newQuantity),
    notes: `Inventory count adjustment (session ${sessionId}): ${data.adjustmentReason}`,
    userId: session.user!.id,
  })

  // Log the approval in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user!.organisationId,
    userId: session.user!.id,
    action: 'approve',
    entityType: 'inventory_count_item',
    entityId: itemId,
    oldValues: item,
    newValues: updated,
  })

  return updated
})
