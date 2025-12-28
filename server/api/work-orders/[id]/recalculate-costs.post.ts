import { and, eq, sum } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

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

  // Get the work order with assignee info
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    with: {
      assignee: {
        columns: {
          hourlyRate: true,
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

  // Calculate parts cost - sum of all work order parts totalCost
  const partsResult = await db
    .select({
      total: sum(schema.workOrderParts.totalCost),
    })
    .from(schema.workOrderParts)
    .where(eq(schema.workOrderParts.workOrderId, id))

  const partsCost = Number.parseFloat(partsResult[0]?.total || '0')

  // Calculate labor cost - actual duration (minutes) * hourly rate / 60
  let laborCost = 0
  if (workOrder.actualDuration && workOrder.assignee?.hourlyRate) {
    const hours = workOrder.actualDuration / 60
    const hourlyRate = Number.parseFloat(workOrder.assignee.hourlyRate)
    laborCost = hours * hourlyRate
  }

  const totalCost = partsCost + laborCost

  // Update the work order with calculated costs
  const [updated] = await db
    .update(schema.workOrders)
    .set({
      partsCost: partsCost.toFixed(2),
      laborCost: laborCost.toFixed(2),
      totalCost: totalCost.toFixed(2),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.workOrders.id, id),
        eq(schema.workOrders.organisationId, session.user.organisationId),
      ),
    )
    .returning()

  return {
    partsCost,
    laborCost,
    totalCost,
    workOrder: updated,
  }
})
