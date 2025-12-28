import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

/**
 * Get the most recent location for a specific asset
 *
 * Returns the latest GPS location record and the asset's stored location.
 */

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Get asset with its stored location
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
      make: true,
      model: true,
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

  // Get the most recent location record
  const [latestRecord] = await db
    .select({
      id: schema.locationRecords.id,
      operatorSessionId: schema.locationRecords.operatorSessionId,
      latitude: schema.locationRecords.latitude,
      longitude: schema.locationRecords.longitude,
      accuracy: schema.locationRecords.accuracy,
      altitude: schema.locationRecords.altitude,
      speed: schema.locationRecords.speed,
      heading: schema.locationRecords.heading,
      recordedAt: schema.locationRecords.recordedAt,
    })
    .from(schema.locationRecords)
    .where(eq(schema.locationRecords.assetId, assetId))
    .orderBy(desc(schema.locationRecords.recordedAt))
    .limit(1)

  // Get current operator session if any
  const activeSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.assetId, assetId),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return {
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
      currentLocation: {
        latitude: asset.latitude,
        longitude: asset.longitude,
        locationName: asset.locationName,
        locationAddress: asset.locationAddress,
        lastUpdate: asset.lastLocationUpdate,
      },
    },
    latestRecord: latestRecord || null,
    activeSession: activeSession
      ? {
          id: activeSession.id,
          startTime: activeSession.startTime,
          operator: activeSession.operator,
        }
      : null,
    isTracking: !!activeSession,
  }
})
