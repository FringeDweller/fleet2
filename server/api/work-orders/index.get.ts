import { and, eq, ilike, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require work_orders:read permission
  const user = await requirePermission(event, 'work_orders:read')

  const query = getQuery(event)
  const search = query.search as string | undefined
  const status = query.status as string | undefined
  const priority = query.priority as string | undefined
  const assignedToId = query.assignedToId as string | undefined
  const assetId = query.assetId as string | undefined
  const scheduleId = query.scheduleId as string | undefined
  const overdue = query.overdue === 'true'
  const includeArchived = query.includeArchived === 'true'

  const conditions = [eq(schema.workOrders.organisationId, user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.workOrders.isArchived, false))
  }

  const validStatuses = [
    'draft',
    'open',
    'in_progress',
    'pending_parts',
    'completed',
    'closed',
  ] as const
  if (status && validStatuses.includes(status as (typeof validStatuses)[number])) {
    conditions.push(eq(schema.workOrders.status, status as (typeof validStatuses)[number]))
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'] as const
  if (priority && validPriorities.includes(priority as (typeof validPriorities)[number])) {
    conditions.push(eq(schema.workOrders.priority, priority as (typeof validPriorities)[number]))
  }

  if (assignedToId) {
    if (assignedToId === 'null') {
      conditions.push(isNull(schema.workOrders.assignedToId))
    } else {
      conditions.push(eq(schema.workOrders.assignedToId, assignedToId))
    }
  }

  if (assetId) {
    conditions.push(eq(schema.workOrders.assetId, assetId))
  }

  // Filter by maintenance schedule (through junction table)
  if (scheduleId) {
    const scheduleWorkOrders = await db.query.maintenanceScheduleWorkOrders.findMany({
      where: eq(schema.maintenanceScheduleWorkOrders.scheduleId, scheduleId),
      columns: { workOrderId: true },
    })
    const workOrderIds = scheduleWorkOrders.map((swo) => swo.workOrderId)
    if (workOrderIds.length > 0) {
      conditions.push(inArray(schema.workOrders.id, workOrderIds))
    } else {
      // No work orders for this schedule, return empty
      return []
    }
  }

  if (overdue) {
    conditions.push(lte(schema.workOrders.dueDate, new Date()))
    conditions.push(
      or(
        eq(schema.workOrders.status, 'open'),
        eq(schema.workOrders.status, 'in_progress'),
        eq(schema.workOrders.status, 'pending_parts'),
      )!,
    )
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.workOrders.workOrderNumber, `%${search}%`),
        ilike(schema.workOrders.title, `%${search}%`),
        ilike(schema.workOrders.description, `%${search}%`),
      )!,
    )
  }

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      assignee: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (workOrders, { desc }) => [desc(workOrders.createdAt)],
  })

  return workOrders
})
