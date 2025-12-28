import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * Get the complete route for an operator session
 *
 * Returns all location records captured during the session in chronological order.
 * Useful for displaying route history or playback.
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
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

  // Get the operator session with asset and operator info
  const operatorSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.id, sessionId),
      eq(schema.operatorSessions.organisationId, user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!operatorSession) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Operator session not found',
    })
  }

  // Get all location records for this session in chronological order
  const locationRecords = await db
    .select({
      id: schema.locationRecords.id,
      latitude: schema.locationRecords.latitude,
      longitude: schema.locationRecords.longitude,
      accuracy: schema.locationRecords.accuracy,
      altitude: schema.locationRecords.altitude,
      speed: schema.locationRecords.speed,
      heading: schema.locationRecords.heading,
      recordedAt: schema.locationRecords.recordedAt,
    })
    .from(schema.locationRecords)
    .where(eq(schema.locationRecords.operatorSessionId, sessionId))
    .orderBy(asc(schema.locationRecords.recordedAt))

  // Calculate route statistics
  let totalDistance = 0
  let maxSpeed = 0
  let avgSpeed = 0
  let speedCount = 0

  for (let i = 1; i < locationRecords.length; i++) {
    const prev = locationRecords[i - 1]
    const curr = locationRecords[i]

    if (!prev || !curr) continue

    // Calculate distance using Haversine formula
    const lat1 = Number(prev.latitude)
    const lon1 = Number(prev.longitude)
    const lat2 = Number(curr.latitude)
    const lon2 = Number(curr.longitude)

    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    totalDistance += R * c

    // Track speed stats
    if (curr.speed) {
      const speed = Number(curr.speed)
      maxSpeed = Math.max(maxSpeed, speed)
      avgSpeed += speed
      speedCount++
    }
  }

  if (speedCount > 0) {
    avgSpeed = avgSpeed / speedCount
  }

  // Calculate duration
  let durationMinutes = 0
  if (locationRecords.length >= 2) {
    const firstRecord = locationRecords[0]
    const lastRecord = locationRecords[locationRecords.length - 1]
    if (firstRecord && lastRecord) {
      durationMinutes = Math.round(
        (new Date(lastRecord.recordedAt).getTime() - new Date(firstRecord.recordedAt).getTime()) /
          60000,
      )
    }
  }

  return {
    session: {
      id: operatorSession.id,
      startTime: operatorSession.startTime,
      endTime: operatorSession.endTime,
      status: operatorSession.status,
      startOdometer: operatorSession.startOdometer,
      endOdometer: operatorSession.endOdometer,
      tripDistance: operatorSession.tripDistance,
      tripDurationMinutes: operatorSession.tripDurationMinutes,
    },
    asset: operatorSession.asset,
    operator: operatorSession.operator,
    route: locationRecords,
    statistics: {
      totalPoints: locationRecords.length,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      durationMinutes,
      maxSpeedKmh: Math.round(maxSpeed * 100) / 100,
      avgSpeedKmh: Math.round(avgSpeed * 100) / 100,
    },
  }
})
