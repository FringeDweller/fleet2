import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    with: {
      asset: true,
      template: true,
      assignedTo: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          phone: true,
          hourlyRate: true,
        },
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      checklistItems: {
        orderBy: (items, { asc }) => [asc(items.order)],
      },
      parts: {
        orderBy: (parts, { desc }) => [desc(parts.createdAt)],
      },
      photos: {
        orderBy: (photos, { desc }) => [desc(photos.createdAt)],
      },
      statusHistory: {
        orderBy: (history, { desc }) => [desc(history.createdAt)],
        with: {
          changedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  return workOrder
})
