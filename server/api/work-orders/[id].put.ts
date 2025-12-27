import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'
import {
  createWorkOrderAssignedNotification,
  createWorkOrderUnassignedNotification
} from '../../utils/notifications'

const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  actualDuration: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  completionNotes: z.string().optional().nullable()
})

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
  const result = updateWorkOrderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Get existing work order for audit log
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

  const updateData: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (result.data.title !== undefined) updateData.title = result.data.title
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.assignedToId !== undefined) updateData.assignedToId = result.data.assignedToId
  if (result.data.priority !== undefined) updateData.priority = result.data.priority
  if (result.data.dueDate !== undefined)
    updateData.dueDate = result.data.dueDate ? new Date(result.data.dueDate) : null
  if (result.data.estimatedDuration !== undefined)
    updateData.estimatedDuration = result.data.estimatedDuration
  if (result.data.actualDuration !== undefined)
    updateData.actualDuration = result.data.actualDuration
  if (result.data.notes !== undefined) updateData.notes = result.data.notes
  if (result.data.completionNotes !== undefined)
    updateData.completionNotes = result.data.completionNotes

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

  if (!workOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update work order'
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'work_order',
    entityId: workOrder.id,
    oldValues: existing,
    newValues: workOrder
  })

  // Handle assignment notifications
  const assignedByName = `${session.user.firstName} ${session.user.lastName}`
  const oldAssignee = existing.assignedToId
  const newAssignee = workOrder.assignedToId

  // If assignee changed
  if (oldAssignee !== newAssignee) {
    // Notify the old assignee they were unassigned
    if (oldAssignee && oldAssignee !== session.user.id) {
      await createWorkOrderUnassignedNotification({
        organisationId: session.user.organisationId,
        userId: oldAssignee,
        workOrderNumber: workOrder.workOrderNumber,
        workOrderTitle: workOrder.title,
        unassignedByName: assignedByName
      })
    }

    // Notify the new assignee they were assigned
    if (newAssignee && newAssignee !== session.user.id) {
      await createWorkOrderAssignedNotification({
        organisationId: session.user.organisationId,
        userId: newAssignee,
        workOrderNumber: workOrder.workOrderNumber,
        workOrderTitle: workOrder.title,
        workOrderId: workOrder.id,
        assignedByName
      })
    }
  }

  return workOrder
})
