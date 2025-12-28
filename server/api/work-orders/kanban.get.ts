import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

const STATUSES = ['draft', 'open', 'in_progress', 'pending_parts', 'completed', 'closed'] as const

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const assignedToId = query.assignedToId as string | undefined
  const priority = query.priority as string | undefined

  const conditions = [
    eq(schema.workOrders.organisationId, session.user.organisationId),
    eq(schema.workOrders.isArchived, false),
  ]

  if (assignedToId) {
    conditions.push(eq(schema.workOrders.assignedToId, assignedToId))
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'] as const
  if (priority && validPriorities.includes(priority as (typeof validPriorities)[number])) {
    conditions.push(eq(schema.workOrders.priority, priority as (typeof validPriorities)[number]))
  }

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      assignee: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: (workOrders, { asc, desc }) => [
      desc(workOrders.priority),
      asc(workOrders.dueDate),
      desc(workOrders.createdAt),
    ],
  })

  // Group by status
  const grouped = STATUSES.reduce(
    (acc, status) => {
      acc[status] = workOrders.filter((wo) => wo.status === status)
      return acc
    },
    {} as Record<(typeof STATUSES)[number], typeof workOrders>,
  )

  return {
    columns: STATUSES.map((status) => ({
      id: status,
      title: formatStatusTitle(status),
      count: grouped[status].length,
      workOrders: grouped[status],
    })),
  }
})

function formatStatusTitle(status: string): string {
  const titles: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    in_progress: 'In Progress',
    pending_parts: 'Pending Parts',
    completed: 'Completed',
    closed: 'Closed',
  }
  return titles[status] || status
}
