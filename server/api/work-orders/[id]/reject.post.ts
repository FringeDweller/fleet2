import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { createWorkOrderRejectedNotification } from '../../../utils/notifications'
import { isManager, requireAuth } from '../../../utils/permissions'

const rejectSchema = z.object({
  reason: z.string().min(1, 'A reason is required when rejecting a work order'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Check if user is manager or above
  if (!isManager(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only managers and administrators can reject work orders',
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
  const result = rejectSchema.safeParse(body)

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
      eq(schema.workOrders.organisationId, user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Only pending_approval work orders can be rejected
  if (existing.status !== 'pending_approval') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only work orders pending approval can be rejected',
    })
  }

  // Find the pending approval request
  const pendingApproval = await db.query.workOrderApprovals.findFirst({
    where: and(
      eq(schema.workOrderApprovals.workOrderId, id),
      eq(schema.workOrderApprovals.status, 'pending'),
    ),
  })

  if (!pendingApproval) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No pending approval request found for this work order',
    })
  }

  // Update the approval record
  const now = new Date()
  await db
    .update(schema.workOrderApprovals)
    .set({
      status: 'rejected',
      reviewedById: user.id,
      reviewedAt: now,
      reviewNotes: result.data.reason,
      updatedAt: now,
    })
    .where(eq(schema.workOrderApprovals.id, pendingApproval.id))

  // Revert work order status to draft so it can be modified and resubmitted
  const [workOrder] = await db
    .update(schema.workOrders)
    .set({
      status: 'draft',
      updatedAt: now,
    })
    .where(eq(schema.workOrders.id, id))
    .returning()

  // Create status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: id,
    fromStatus: 'pending_approval',
    toStatus: 'draft',
    changedById: user.id,
    notes: `Rejected by ${user.firstName} ${user.lastName}: ${result.data.reason}`,
  })

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'reject',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: 'pending_approval', approvalStatus: 'pending' },
    newValues: { status: 'draft', approvalStatus: 'rejected', reason: result.data.reason },
  })

  // Notify the person who requested approval
  if (pendingApproval.requestedById !== user.id) {
    await createWorkOrderRejectedNotification({
      organisationId: user.organisationId,
      userId: pendingApproval.requestedById,
      workOrderNumber: existing.workOrderNumber,
      workOrderTitle: existing.title,
      workOrderId: id,
      rejectedByName: `${user.firstName} ${user.lastName}`,
      reason: result.data.reason,
    })
  }

  return {
    success: true,
    workOrder,
    message: 'Work order rejected',
  }
})
