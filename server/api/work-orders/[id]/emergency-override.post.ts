import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { isManager, requireAuth } from '../../../utils/permissions'

const emergencyOverrideSchema = z.object({
  emergencyReason: z.string().min(10, 'Emergency reason must be at least 10 characters'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Check if user is manager or above
  if (!isManager(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only managers and administrators can use emergency override',
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
  const result = emergencyOverrideSchema.safeParse(body)

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

  // Only draft or pending_approval work orders can use emergency override
  if (!['draft', 'pending_approval'].includes(existing.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Emergency override can only be used on draft or pending approval work orders',
    })
  }

  const now = new Date()

  // If there's a pending approval, update it
  const pendingApproval = await db.query.workOrderApprovals.findFirst({
    where: and(
      eq(schema.workOrderApprovals.workOrderId, id),
      eq(schema.workOrderApprovals.status, 'pending'),
    ),
  })

  if (pendingApproval) {
    // Update the existing approval with emergency override
    await db
      .update(schema.workOrderApprovals)
      .set({
        status: 'approved',
        isEmergencyOverride: true,
        emergencyReason: result.data.emergencyReason,
        emergencyOverrideById: user.id,
        emergencyOverrideAt: now,
        reviewedById: user.id,
        reviewedAt: now,
        reviewNotes: `Emergency override: ${result.data.emergencyReason}`,
        updatedAt: now,
      })
      .where(eq(schema.workOrderApprovals.id, pendingApproval.id))
  } else {
    // Create a new approval record with emergency override
    await db.insert(schema.workOrderApprovals).values({
      organisationId: user.organisationId,
      workOrderId: id,
      status: 'approved',
      requestedById: user.id,
      isEmergencyOverride: true,
      emergencyReason: result.data.emergencyReason,
      emergencyOverrideById: user.id,
      emergencyOverrideAt: now,
      reviewedById: user.id,
      reviewedAt: now,
      reviewNotes: `Emergency override: ${result.data.emergencyReason}`,
    })
  }

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
    fromStatus: existing.status,
    toStatus: 'open',
    changedById: user.id,
    notes: `Emergency override by ${user.firstName} ${user.lastName}: ${result.data.emergencyReason}`,
  })

  // Log in audit log with special action for emergency override
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'emergency_override',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: {
      status: 'open',
      emergencyOverride: true,
      emergencyReason: result.data.emergencyReason,
    },
  })

  return {
    success: true,
    workOrder,
    message: 'Emergency override applied - work order is now open',
  }
})
