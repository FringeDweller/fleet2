import { db, schema } from '../../../../utils/db'
import { eq, and } from 'drizzle-orm'

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

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId)
    ),
    columns: { id: true }
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found'
    })
  }

  const items = await db.query.workOrderChecklistItems.findMany({
    where: eq(schema.workOrderChecklistItems.workOrderId, id),
    with: {
      completedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: (items, { asc }) => [asc(items.order)]
  })

  return items
})
