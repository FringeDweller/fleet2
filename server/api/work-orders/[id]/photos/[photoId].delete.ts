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
  const photoId = getRouterParam(event, 'photoId')

  if (!id || !photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID and photo ID are required'
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

  // Delete the photo record
  // Note: actual file deletion from storage should be handled separately
  const [deleted] = await db
    .delete(schema.workOrderPhotos)
    .where(
      and(
        eq(schema.workOrderPhotos.id, photoId),
        eq(schema.workOrderPhotos.workOrderId, id)
      )
    )
    .returning({ id: schema.workOrderPhotos.id })

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found'
    })
  }

  return { success: true }
})
