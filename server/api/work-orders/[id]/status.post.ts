import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { eq, and } from 'drizzle-orm'

const statusSchema = z.object({
  status: z.enum(['draft', 'open', 'in_progress', 'pending_parts', 'completed', 'closed']),
  notes: z.string().optional()
})

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['open'],
  open: ['in_progress', 'closed'],
  in_progress: ['pending_parts', 'completed', 'open'],
  pending_parts: ['in_progress', 'open'],
  completed: ['closed', 'in_progress'],
  closed: [] // Terminal state
}

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required'
    })
  }

  const body = await readBody(event)
  const result = statusSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Get existing work order
  const existing = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found'
    })
  }

  // Validate status transition
  if (!isValidTransition(existing.status, result.data.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status transition from '${existing.status}' to '${result.data.status}'`
    })
  }

  const now = new Date()
  const updateData: Record<string, unknown> = {
    status: result.data.status,
    updatedAt: now
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
        eq(schema.workOrders.organisationId, session.user.organisationId)
      )
    )
    .returning()

  // Create status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: id,
    fromStatus: existing.status,
    toStatus: result.data.status,
    changedById: session.user.id,
    notes: result.data.notes
  })

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'status_change',
    entityType: 'work_order',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: result.data.status }
  })

  return workOrder
})
