import { db, schema } from '../../utils/db'
import { eq, and, ne } from 'drizzle-orm'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const workOrders = await db.query.workOrders.findMany({
    where: and(
      eq(schema.workOrders.organisationId, session.user.organisationId),
      eq(schema.workOrders.assignedToId, session.user.id),
      eq(schema.workOrders.isArchived, false),
      ne(schema.workOrders.status, 'closed')
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true
        }
      }
    },
    orderBy: (workOrders, { asc, desc }) => [
      // Prioritize in_progress, then by due date
      asc(workOrders.dueDate),
      desc(workOrders.priority)
    ]
  })

  return workOrders
})
