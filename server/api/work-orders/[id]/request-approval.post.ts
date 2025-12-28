import { and, eq, sum } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { createApprovalRequestedNotification } from '../../../utils/notifications'
import { isManager, requirePermission } from '../../../utils/permissions'

const requestApprovalSchema = z.object({
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'work_orders:write')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  const body = await readBody(event)
  const result = requestApprovalSchema.safeParse(body)

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
    with: {
      parts: true,
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Only draft work orders can be submitted for approval
  if (existing.status !== 'draft') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only draft work orders can be submitted for approval',
    })
  }

  // Check if there's already a pending approval
  const existingApproval = await db.query.workOrderApprovals.findFirst({
    where: and(
      eq(schema.workOrderApprovals.workOrderId, id),
      eq(schema.workOrderApprovals.status, 'pending'),
    ),
  })

  if (existingApproval) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This work order already has a pending approval request',
    })
  }

  // Calculate estimated total cost from parts
  const partsResult = await db
    .select({
      total: sum(schema.workOrderParts.totalCost),
    })
    .from(schema.workOrderParts)
    .where(eq(schema.workOrderParts.workOrderId, id))

  const estimatedCost = partsResult[0]?.total || '0.00'

  // Get organisation settings
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
    columns: {
      workOrderApprovalThreshold: true,
      requireApprovalForAllWorkOrders: true,
    },
  })

  // Check if approval is actually required
  const threshold = organisation?.workOrderApprovalThreshold
    ? Number.parseFloat(organisation.workOrderApprovalThreshold)
    : null
  const requireAll = organisation?.requireApprovalForAllWorkOrders ?? false
  const costAmount = Number.parseFloat(estimatedCost)

  const approvalRequired = requireAll || (threshold !== null && costAmount >= threshold)

  if (!approvalRequired) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Approval is not required for this work order. You can open it directly.',
    })
  }

  // Create the approval request
  const approvalResult = await db
    .insert(schema.workOrderApprovals)
    .values({
      organisationId: user.organisationId,
      workOrderId: id,
      status: 'pending',
      requestedById: user.id,
      requestNotes: result.data.notes,
      estimatedCostAtRequest: estimatedCost,
    })
    .returning()

  const approval = approvalResult[0]
  if (!approval) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create approval request',
    })
  }

  // Update work order status to pending_approval
  await db
    .update(schema.workOrders)
    .set({
      status: 'pending_approval',
      updatedAt: new Date(),
    })
    .where(eq(schema.workOrders.id, id))

  // Create status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: id,
    fromStatus: existing.status,
    toStatus: 'pending_approval',
    changedById: user.id,
    notes: 'Submitted for approval',
  })

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'request_approval',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'pending_approval', approvalId: approval.id },
  })

  // Notify managers/admins who can approve
  const approvers = await db.query.users.findMany({
    where: and(
      eq(schema.users.organisationId, user.organisationId),
      eq(schema.users.isActive, true),
    ),
    with: {
      role: true,
    },
  })

  // Filter to users who can approve (managers and admins)
  for (const approver of approvers) {
    if (approver.id === user.id) continue // Don't notify the requester

    const userWithPermissions = {
      ...approver,
      roleName: approver.role?.name as
        | 'super_admin'
        | 'admin'
        | 'fleet_manager'
        | 'supervisor'
        | 'technician'
        | 'operator',
      permissions: (approver.role?.permissions as string[]) || [],
    }

    // Only notify if user is manager or above
    if (isManager(userWithPermissions)) {
      await createApprovalRequestedNotification({
        organisationId: user.organisationId,
        userId: approver.id,
        workOrderNumber: existing.workOrderNumber,
        workOrderTitle: existing.title,
        workOrderId: id,
        requestedByName: `${user.firstName} ${user.lastName}`,
        estimatedCost,
      })
    }
  }

  return {
    success: true,
    approval,
    message: 'Approval request submitted successfully',
  }
})
