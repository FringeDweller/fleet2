import { db, schema } from '../../utils/db'
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
      statusMessage: 'Schedule ID is required'
    })
  }

  const schedule = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(schema.maintenanceSchedules.id, id),
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
    ),
    with: {
      asset: true,
      category: true,
      template: true,
      defaultAssignee: {
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
      },
      generatedWorkOrders: {
        with: {
          workOrder: {
            columns: {
              id: true,
              workOrderNumber: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true
            }
          }
        },
        orderBy: (orders, { desc }) => [desc(orders.scheduledDate)]
      }
    }
  })

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Maintenance schedule not found'
    })
  }

  return schedule
})
