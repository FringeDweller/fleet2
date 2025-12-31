import { and, eq, isNotNull, sum } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { resolveDtcWorkOrderHistory } from '../../../utils/dtc-work-order-service'

interface StockWarning {
  partId: string
  partName: string
  requested: number
  available: number
  deducted: number
}

interface InsufficientStock {
  partId: string
  partName: string
  requested: number
  available: number
}

// Check if any parts have insufficient stock
async function checkInsufficientStock(workOrderId: string): Promise<InsufficientStock[]> {
  const insufficient: InsufficientStock[] = []

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
        },
      },
    },
  })

  for (const woPart of workOrderParts) {
    if (!woPart.part || !woPart.partId) continue
    const currentStock = parseFloat(woPart.part.quantityInStock)
    if (currentStock < woPart.quantity) {
      insufficient.push({
        partId: woPart.partId,
        partName: woPart.partName,
        requested: woPart.quantity,
        available: currentStock,
      })
    }
  }

  return insufficient
}

// Deduct parts from inventory when work order is completed
async function deductPartsFromInventory(
  workOrderId: string,
  userId: string,
  allowNegative: boolean,
): Promise<{ success: boolean; warnings: StockWarning[]; blocked?: InsufficientStock[] }> {
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

  // If preventing negative stock, check all parts first
  if (!allowNegative) {
    const insufficient = await checkInsufficientStock(workOrderId)
    if (insufficient.length > 0) {
      return { success: false, warnings: [], blocked: insufficient }
    }
  }

  // Process each part in a transaction
  await db.transaction(async (tx) => {
    for (const woPart of workOrderParts) {
      if (!woPart.part || !woPart.partId) continue

      const currentStock = parseFloat(woPart.part.quantityInStock)
      const requested = woPart.quantity
      const deducted = Math.min(requested, Math.max(0, currentStock))
      const newQuantity = currentStock - requested

      // Track warning if insufficient stock (even if we allow negative)
      if (currentStock < requested) {
        warnings.push({
          partId: woPart.partId,
          partName: woPart.partName,
          requested,
          available: currentStock,
          deducted,
        })
      }

      // Update inventory
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
// Note: pending_approval is handled via request-approval, approve, reject, and emergency-override endpoints
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['open'],
  pending_approval: [], // Can only transition via approve/reject/emergency-override endpoints
  open: ['in_progress', 'closed'],
  in_progress: ['pending_parts', 'completed', 'open'],
  pending_parts: ['in_progress', 'open'],
  completed: ['closed', 'in_progress'],
  closed: [], // Terminal state
}

// Check if work order requires approval based on org settings and cost
async function checkApprovalRequired(
  organisationId: string,
  workOrderId: string,
): Promise<{ required: boolean; reason?: string }> {
  // Get organisation settings for approval threshold
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, organisationId),
    columns: {
      workOrderApprovalThreshold: true,
      requireApprovalForAllWorkOrders: true,
    },
  })

  const requireAll = organisation?.requireApprovalForAllWorkOrders ?? false
  const threshold = organisation?.workOrderApprovalThreshold
    ? Number.parseFloat(organisation.workOrderApprovalThreshold)
    : null

  if (requireAll) {
    return {
      required: true,
      reason:
        'This organisation requires approval for all work orders. Please submit for approval instead.',
    }
  }

  if (threshold !== null) {
    // Calculate estimated total cost from parts
    const partsResult = await db
      .select({
        total: sum(schema.workOrderParts.totalCost),
      })
      .from(schema.workOrderParts)
      .where(eq(schema.workOrderParts.workOrderId, workOrderId))

    const estimatedCost = Number.parseFloat(partsResult[0]?.total || '0')

    if (estimatedCost >= threshold) {
      return {
        required: true,
        reason: `This work order exceeds the approval threshold of $${threshold.toFixed(2)}. Please submit for approval instead.`,
      }
    }
  }

  return { required: false }
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

  // Check if approval is required when transitioning from draft to open
  if (existing.status === 'draft' && result.data.status === 'open') {
    const approvalCheck = await checkApprovalRequired(session.user.organisationId, id)
    if (approvalCheck.required) {
      throw createError({
        statusCode: 400,
        statusMessage: approvalCheck.reason,
      })
    }
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

  if (!workOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update work order',
    })
  }

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
    // Check organisation setting for preventing negative stock
    const organisation = await db.query.organisations.findFirst({
      where: eq(schema.organisations.id, session.user.organisationId),
      columns: { preventNegativeStock: true },
    })
    const allowNegative = !organisation?.preventNegativeStock

    const deductionResult = await deductPartsFromInventory(id, session.user.id, allowNegative)

    // If blocked due to insufficient stock, throw error
    if (!deductionResult.success && deductionResult.blocked) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot complete work order: insufficient stock for some parts',
        data: {
          insufficientStock: deductionResult.blocked,
        },
      })
    }

    stockWarnings = deductionResult.warnings

    // Calculate and update costs when completing
    const partsResult = await db
      .select({
        total: sum(schema.workOrderParts.totalCost),
      })
      .from(schema.workOrderParts)
      .where(eq(schema.workOrderParts.workOrderId, id))

    const partsCost = Number.parseFloat(partsResult[0]?.total || '0')

    // Get assignee hourly rate for labor cost calculation
    let laborCost = 0
    if (workOrder.actualDuration && workOrder.assignedToId) {
      const assignee = await db.query.users.findFirst({
        where: eq(schema.users.id, workOrder.assignedToId),
        columns: { hourlyRate: true },
      })
      if (assignee?.hourlyRate) {
        const hours = workOrder.actualDuration / 60
        laborCost = hours * Number.parseFloat(assignee.hourlyRate)
      }
    }

    const totalCost = partsCost + laborCost

    // Update work order with costs
    await db
      .update(schema.workOrders)
      .set({
        partsCost: partsCost.toFixed(2),
        laborCost: laborCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
      })
      .where(eq(schema.workOrders.id, id))

    // Update return value with costs
    workOrder.partsCost = partsCost.toFixed(2)
    workOrder.laborCost = laborCost.toFixed(2)
    workOrder.totalCost = totalCost.toFixed(2)

    // Resolve any DTC work order history entries linked to this work order
    // This allows new work orders to be created if the same DTC reoccurs
    await resolveDtcWorkOrderHistory(id)
  }

  // Also resolve DTC history when closing a work order
  if (result.data.status === 'closed') {
    await resolveDtcWorkOrderHistory(id)
  }

  return {
    ...workOrder,
    stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
  }
})
