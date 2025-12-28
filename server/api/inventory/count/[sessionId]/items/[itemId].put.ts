import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../../utils/db'

const updateCountItemSchema = z.object({
  countedQuantity: z.string().regex(/^\d+(\.\d{1,2})?$/),
  notes: z.string().optional(),
})

/**
 * Update counted quantity for an inventory count item
 * REQ-606-AC-02: Enter counted quantities
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
  const result = updateCountItemSchema.safeParse(body)

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
      statusMessage: 'Cannot update items for completed or cancelled sessions',
    })
  }

  // Calculate discrepancy
  const systemQty = parseFloat(item.systemQuantity)
  const countedQty = parseFloat(data.countedQuantity)
  const discrepancy = countedQty - systemQty

  // Update the item
  const [updated] = await db
    .update(schema.inventoryCountItems)
    .set({
      countedQuantity: data.countedQuantity,
      discrepancy: discrepancy.toFixed(2),
      status: 'counted',
      countedAt: new Date(),
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.inventoryCountItems.id, itemId))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update inventory count item',
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'inventory_count_item',
    entityId: itemId,
    oldValues: item,
    newValues: updated,
  })

  return updated
})
