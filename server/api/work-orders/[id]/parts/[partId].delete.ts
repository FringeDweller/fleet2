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
  const partId = getRouterParam(event, 'partId')

  if (!id || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID and part ID are required'
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

  // Delete the part
  const [deleted] = await db
    .delete(schema.workOrderParts)
    .where(and(eq(schema.workOrderParts.id, partId), eq(schema.workOrderParts.workOrderId, id)))
    .returning({ id: schema.workOrderParts.id })

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found'
    })
  }

  return { success: true }
})
