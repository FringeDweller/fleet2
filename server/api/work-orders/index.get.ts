import { db, schema } from '../../utils/db'
import { eq, and, ilike, or, lte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const status = query.status as string | undefined
  const priority = query.priority as string | undefined
  const assignedToId = query.assignedToId as string | undefined
  const assetId = query.assetId as string | undefined
  const overdue = query.overdue === 'true'
  const includeArchived = query.includeArchived === 'true'

  const conditions = [eq(schema.workOrders.organisationId, session.user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.workOrders.isArchived, false))
  }

  const validStatuses = ['draft', 'open', 'in_progress', 'pending_parts', 'completed', 'closed'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    conditions.push(eq(schema.workOrders.status, status as typeof validStatuses[number]))
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'] as const
  if (priority && validPriorities.includes(priority as typeof validPriorities[number])) {
    conditions.push(eq(schema.workOrders.priority, priority as typeof validPriorities[number]))
  }

  if (assignedToId) {
    conditions.push(eq(schema.workOrders.assignedToId, assignedToId))
  }

  if (assetId) {
    conditions.push(eq(schema.workOrders.assetId, assetId))
  }

  if (overdue) {
    conditions.push(lte(schema.workOrders.dueDate, new Date()))
    conditions.push(
      or(
        eq(schema.workOrders.status, 'open'),
        eq(schema.workOrders.status, 'in_progress'),
        eq(schema.workOrders.status, 'pending_parts')
      )!
    )
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.workOrders.workOrderNumber, `%${search}%`),
        ilike(schema.workOrders.title, `%${search}%`),
        ilike(schema.workOrders.description, `%${search}%`)
      )!
    )
  }

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      assignedTo: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: (workOrders, { desc }) => [desc(workOrders.createdAt)]
  })

  return workOrders
})
