import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const partId = getRouterParam(event, 'id')

  if (!partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part ID is required',
    })
  }

  // Verify part exists and belongs to organisation
  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, partId),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Get all quantities by location for this part
  const quantities = await db.query.partLocationQuantities.findMany({
    where: and(
      eq(schema.partLocationQuantities.partId, partId),
      eq(schema.partLocationQuantities.organisationId, session.user.organisationId),
    ),
    with: {
      location: true,
    },
    orderBy: (quantities) => quantities.quantity,
  })

  // Calculate total quantity across all locations
  const totalQuantity = quantities.reduce((sum, q) => sum + parseFloat(q.quantity.toString()), 0)

  return {
    partId,
    totalQuantity,
    locations: quantities.map((q) => ({
      id: q.id,
      locationId: q.locationId,
      locationName: q.location?.name,
      locationType: q.location?.type,
      locationCode: q.location?.code,
      quantity: parseFloat(q.quantity.toString()),
    })),
  }
})
