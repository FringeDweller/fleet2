import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'work_orders:read')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  // Verify work order exists and belongs to the user's organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      workOrderNumber: true,
    },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Get all approval records for this work order
  const approvals = await db.query.workOrderApprovals.findMany({
    where: eq(schema.workOrderApprovals.workOrderId, id),
    with: {
      requestedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      reviewedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      emergencyOverrideBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [desc(schema.workOrderApprovals.createdAt)],
  })

  return {
    approvals,
    workOrderNumber: workOrder.workOrderNumber,
  }
})
