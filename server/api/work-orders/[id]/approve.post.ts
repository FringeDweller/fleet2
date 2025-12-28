import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { createWorkOrderApprovedNotification } from '../../../utils/notifications'
import { isManager, requireAuth } from '../../../utils/permissions'

const approveSchema = z.object({
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Check if user is manager or above
  if (!isManager(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only managers and administrators can approve work orders',
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
  const result = approveSchema.safeParse(body)

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

  // Only pending_approval work orders can be approved
  if (existing.status !== 'pending_approval') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only work orders pending approval can be approved',
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
      status: 'approved',
      reviewedById: user.id,
      reviewedAt: now,
      reviewNotes: result.data.notes,
      updatedAt: now,
    })
    .where(eq(schema.workOrderApprovals.id, pendingApproval.id))

  // Update work order status to open
  const [workOrder] = await db
    .update(schema.workOrders)
    .set({
      status: 'open',
      updatedAt: now,
    })
    .where(eq(schema.workOrders.id, id))
    .returning()

  // Create status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: id,
    fromStatus: 'pending_approval',
    toStatus: 'open',
    changedById: user.id,
    notes: `Approved by ${user.firstName} ${user.lastName}${result.data.notes ? `: ${result.data.notes}` : ''}`,
  })

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'approve',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: 'pending_approval', approvalStatus: 'pending' },
    newValues: { status: 'open', approvalStatus: 'approved' },
  })

  // Notify the person who requested approval
  if (pendingApproval.requestedById !== user.id) {
    await createWorkOrderApprovedNotification({
      organisationId: user.organisationId,
      userId: pendingApproval.requestedById,
      workOrderNumber: existing.workOrderNumber,
      workOrderTitle: existing.title,
      workOrderId: id,
      approvedByName: `${user.firstName} ${user.lastName}`,
    })
  }

  return {
    success: true,
    workOrder,
    message: 'Work order approved successfully',
  }
})
