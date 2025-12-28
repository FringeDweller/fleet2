import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * Get route history for an asset within a date range
 *
 * Returns all location records and operator sessions for the asset
 * within the specified time period. Useful for route history view.
 *
 * @requirement REQ-1203
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'assets:read')

  const assetId = getRouterParam(event, 'id')
  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  const query = getQuery(event)
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Default to last 7 days if no dates provided
  const endDate = dateTo ? new Date(dateTo) : new Date()
  const startDate = dateFrom
    ? new Date(dateFrom)
    : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Verify the asset belongs to the user's organisation
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
      year: true,
      licensePlate: true,
      imageUrl: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get all operator sessions for this asset within the date range
  const sessions = await db.query.operatorSessions.findMany({
    where: and(
      eq(schema.operatorSessions.assetId, assetId),
      eq(schema.operatorSessions.organisationId, user.organisationId),
      gte(schema.operatorSessions.startTime, startDate),
      lte(schema.operatorSessions.startTime, endDate),
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
    orderBy: [asc(schema.operatorSessions.startTime)],
  })

  // Get all location records for this asset within the date range
  const locationRecords = await db
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
    .where(
      and(
        eq(schema.locationRecords.assetId, assetId),
        eq(schema.locationRecords.organisationId, user.organisationId),
        gte(schema.locationRecords.recordedAt, startDate),
        lte(schema.locationRecords.recordedAt, endDate),
      ),
    )
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

  // Identify stops (locations where speed is near 0 or no movement for a period)
  const stops: Array<{
    latitude: number
    longitude: number
    startTime: string
    endTime: string
    durationMinutes: number
  }> = []

  let stopStart: (typeof locationRecords)[0] | null = null
  let stopEnd: (typeof locationRecords)[0] | null = null
  const STOP_SPEED_THRESHOLD = 2 // km/h - considered stopped if below this
  const MIN_STOP_DURATION_MS = 60000 // 1 minute minimum to count as a stop

  for (const record of locationRecords) {
    const speed = record.speed ? Number(record.speed) : 0
    const isMoving = speed > STOP_SPEED_THRESHOLD

    if (!isMoving) {
      if (!stopStart) {
        stopStart = record
        stopEnd = record
      } else {
        stopEnd = record
      }
    } else {
      if (stopStart && stopEnd) {
        const duration =
          new Date(stopEnd.recordedAt).getTime() - new Date(stopStart.recordedAt).getTime()
        if (duration >= MIN_STOP_DURATION_MS) {
          stops.push({
            latitude: Number(stopStart.latitude),
            longitude: Number(stopStart.longitude),
            startTime: stopStart.recordedAt.toISOString(),
            endTime: stopEnd.recordedAt.toISOString(),
            durationMinutes: Math.round(duration / 60000),
          })
        }
      }
      stopStart = null
      stopEnd = null
    }
  }

  // Don't forget the last stop if still in one
  if (stopStart && stopEnd) {
    const duration =
      new Date(stopEnd.recordedAt).getTime() - new Date(stopStart.recordedAt).getTime()
    if (duration >= MIN_STOP_DURATION_MS) {
      stops.push({
        latitude: Number(stopStart.latitude),
        longitude: Number(stopStart.longitude),
        startTime: stopStart.recordedAt.toISOString(),
        endTime: stopEnd.recordedAt.toISOString(),
        durationMinutes: Math.round(duration / 60000),
      })
    }
  }

  return {
    asset,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      operator: session.operator
        ? {
            id: session.operator.id,
            name: `${session.operator.firstName} ${session.operator.lastName}`.trim(),
          }
        : null,
      tripDistance: session.tripDistance,
      tripDurationMinutes: session.tripDurationMinutes,
      startLocationName: session.startLocationName,
      endLocationName: session.endLocationName,
    })),
    route: locationRecords.map((record) => ({
      id: record.id,
      operatorSessionId: record.operatorSessionId,
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      accuracy: record.accuracy ? Number(record.accuracy) : null,
      altitude: record.altitude ? Number(record.altitude) : null,
      speed: record.speed ? Number(record.speed) : null,
      heading: record.heading ? Number(record.heading) : null,
      recordedAt: record.recordedAt.toISOString(),
    })),
    stops,
    statistics: {
      totalPoints: locationRecords.length,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      totalSessions: sessions.length,
      totalStops: stops.length,
      maxSpeedKmh: Math.round(maxSpeed * 100) / 100,
      avgSpeedKmh: Math.round(avgSpeed * 100) / 100,
    },
  }
})
