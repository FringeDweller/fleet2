import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

interface StockWarning {
  partId: string
  partName: string
  requested: number
  available: number
  deducted: number
}

// Deduct parts from inventory when work order is completed
async function deductPartsFromInventory(
  workOrderId: string,
  userId: string,
): Promise<{ success: boolean; warnings: StockWarning[] }> {
  const warnings: StockWarning[] = []

  // Get all work order parts that are linked to inventory
  const workOrderParts = await db.query.workOrderParts.findMany({
    where: and(
      eq(schema.workOrderParts.workOrderId, workOrderId),
      isNotNull(schema.workOrderParts.partId),
    ),
    with: {
      part: {
        columns: {
          id: true,
          name: true,
          quantityInStock: true,
          unitCost: true,
        },
      },
    },
  })

  if (workOrderParts.length === 0) {
    return { success: true, warnings: [] }
  }

  // Process each part in a transaction
  await db.transaction(async (tx) => {
    for (const woPart of workOrderParts) {
      if (!woPart.part || !woPart.partId) continue

      const currentStock = parseFloat(woPart.part.quantityInStock)
      const requested = woPart.quantity
      const deducted = Math.min(requested, Math.max(0, currentStock))
      const newQuantity = currentStock - requested // Can go negative

      // Track warning if insufficient stock
      if (currentStock < requested) {
        warnings.push({
          partId: woPart.partId,
          partName: woPart.partName,
          requested,
          available: currentStock,
          deducted,
        })
      }

      // Update inventory (allow negative stock as per user preference)
      await tx
        .update(schema.parts)
        .set({
          quantityInStock: newQuantity.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.parts.id, woPart.partId))

      // Create usage history record
      await tx.insert(schema.partUsageHistory).values({
        partId: woPart.partId,
        workOrderId,
        usageType: 'work_order',
        quantityChange: (-requested).toFixed(2),
        previousQuantity: currentStock.toFixed(2),
        newQuantity: newQuantity.toFixed(2),
        unitCostAtTime: woPart.unitCost,
        notes: `Used in work order completion`,
        userId,
      })
    }
  })

  return { success: true, warnings }
}

const statusSchema = z.object({
  status: z.enum(['draft', 'open', 'in_progress', 'pending_parts', 'completed', 'closed']),
  notes: z.string().optional(),
})

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['open'],
  open: ['in_progress', 'closed'],
  in_progress: ['pending_parts', 'completed', 'open'],
  pending_parts: ['in_progress', 'open'],
  completed: ['closed', 'in_progress'],
  closed: [], // Terminal state
}

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  const body = await readBody(event)
  const result = statusSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get existing work order
  const existing = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Validate status transition
  if (!isValidTransition(existing.status, result.data.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status transition from '${existing.status}' to '${result.data.status}'`,
    })
  }

  const now = new Date()
  const updateData: Record<string, unknown> = {
    status: result.data.status,
    updatedAt: now,
  }

  // Set timestamps based on new status
  if (result.data.status === 'in_progress' && !existing.startedAt) {
    updateData.startedAt = now
  }
  if (result.data.status === 'completed') {
    updateData.completedAt = now
  }
  if (result.data.status === 'closed') {
    updateData.closedAt = now
  }

  // Update work order status
  const [workOrder] = await db
    .update(schema.workOrders)
    .set(updateData)
    .where(
      and(
        eq(schema.workOrders.id, id),
        eq(schema.workOrders.organisationId, session.user.organisationId),
      ),
    )
    .returning()

  // Create status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: id,
    fromStatus: existing.status,
    toStatus: result.data.status,
    changedById: session.user.id,
    notes: result.data.notes,
  })

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'status_change',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: result.data.status },
  })

  // Deduct parts from inventory when completing work order
  let stockWarnings: StockWarning[] = []
  if (result.data.status === 'completed') {
    const deductionResult = await deductPartsFromInventory(id, session.user.id)
    stockWarnings = deductionResult.warnings
  }

  return {
    ...workOrder,
    stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
  }
})
