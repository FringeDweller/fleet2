import { and, desc, eq } from 'drizzle-orm'
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
      statusMessage: 'Asset ID is required',
    })
  }

  // Get the asset with current location
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
      latitude: true,
      longitude: true,
      locationName: true,
      locationAddress: true,
      lastLocationUpdate: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get location history
  const query = getQuery(event)
  const limit = Number.parseInt(query.limit as string, 10) || 20

  const history = await db.query.assetLocationHistory.findMany({
    where: eq(schema.assetLocationHistory.assetId, id),
    orderBy: [desc(schema.assetLocationHistory.recordedAt)],
    limit,
    with: {
      updatedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return {
    current: {
      latitude: asset.latitude,
      longitude: asset.longitude,
      locationName: asset.locationName,
      locationAddress: asset.locationAddress,
      lastUpdate: asset.lastLocationUpdate,
    },
    history,
  }
})
