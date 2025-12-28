import { and, eq, inArray } from 'drizzle-orm'
import type { GeofenceAlert, NewGeofenceAlert } from '../db/schema/geofence-alerts'
import type { Geofence } from '../db/schema/geofences'
import { db, schema } from './db'
import { recordJobSiteEntry, recordJobSiteExit } from './job-site-visit-processor'
import { createNotification } from './notifications'

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of point 1 in degrees
 * @param lng1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lng2 Longitude of point 2 in degrees
 * @returns Distance in meters
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param lat Latitude of point
 * @param lng Longitude of point
 * @param polygon Array of polygon vertices as {lat, lng} objects
 * @returns true if point is inside polygon
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[],
): boolean {
  if (!polygon || polygon.length < 3) return false

  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pointI = polygon[i]
    const pointJ = polygon[j]
    if (!pointI || !pointJ) continue

    const xi = pointI.lng
    const yi = pointI.lat
    const xj = pointJ.lng
    const yj = pointJ.lat

    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Check if a point is inside a geofence
 */
function isPointInGeofence(lat: number, lng: number, geofence: Geofence): boolean {
  if (geofence.type === 'circle') {
    if (!geofence.centerLatitude || !geofence.centerLongitude || !geofence.radiusMeters) {
      return false
    }
    const distance = haversineDistance(
      lat,
      lng,
      parseFloat(geofence.centerLatitude),
      parseFloat(geofence.centerLongitude),
    )
    return distance <= parseFloat(geofence.radiusMeters)
  }

  if (geofence.type === 'polygon') {
    if (!geofence.polygonCoordinates) return false
    return isPointInPolygon(lat, lng, geofence.polygonCoordinates)
  }

  return false
}

/**
 * Check if current time is during after-hours period
 */
function isAfterHours(geofence: Geofence): boolean {
  if (!geofence.activeStartTime || !geofence.activeEndTime) {
    return false
  }

  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday, 6 = Saturday

  // Check if today is an active day
  if (geofence.activeDays && !geofence.activeDays.includes(currentDay)) {
    return false
  }

  // Get current time as HH:MM string
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const currentTime = `${hours}:${minutes}`

  // Parse the active times (format is PostgreSQL TIME, e.g., "09:00:00")
  const startTime = geofence.activeStartTime.substring(0, 5)
  const endTime = geofence.activeEndTime.substring(0, 5)

  // If start is after end (spans midnight), adjust logic
  if (startTime > endTime) {
    // After hours if NOT between end and start
    return !(currentTime >= endTime && currentTime < startTime)
  } else {
    // After hours if NOT between start and end
    return !(currentTime >= startTime && currentTime < endTime)
  }
}

/**
 * Track position state for entry/exit detection
 */
const positionCache = new Map<string, Map<string, boolean>>()

function getAssetGeofenceKey(assetId: string, geofenceId: string): string {
  return `${assetId}:${geofenceId}`
}

function getOrCreateAssetPositionCache(assetId: string): Map<string, boolean> {
  if (!positionCache.has(assetId)) {
    positionCache.set(assetId, new Map())
  }
  return positionCache.get(assetId)!
}

/**
 * Check and create geofence alerts for an asset at a given location
 *
 * @param organisationId Organisation ID
 * @param assetId Asset ID
 * @param latitude Current latitude
 * @param longitude Current longitude
 * @param operatorSessionId Optional operator session ID
 * @returns Array of created alerts
 */
export async function checkGeofenceAlerts(
  organisationId: string,
  assetId: string,
  latitude: number,
  longitude: number,
  operatorSessionId?: string | null,
): Promise<GeofenceAlert[]> {
  // Get all active geofences for this organisation with their alert settings
  const geofences = await db.query.geofences.findMany({
    where: and(
      eq(schema.geofences.organisationId, organisationId),
      eq(schema.geofences.isActive, true),
    ),
    with: {
      alertSettings: true,
    },
  })

  if (geofences.length === 0) return []

  const alerts: GeofenceAlert[] = []
  const assetCache = getOrCreateAssetPositionCache(assetId)
  const now = new Date()

  for (const geofence of geofences) {
    const settings = geofence.alertSettings?.[0]
    if (!settings) continue

    const isInside = isPointInGeofence(latitude, longitude, geofence)
    const wasInside = assetCache.get(geofence.id)

    // Update cache
    assetCache.set(geofence.id, isInside)

    // Skip if we don't have previous state (first check for this asset/geofence)
    if (wasInside === undefined) continue

    const alertsToCreate: NewGeofenceAlert[] = []

    // Check for entry
    if (!wasInside && isInside && settings.alertOnEntry) {
      alertsToCreate.push({
        organisationId,
        geofenceId: geofence.id,
        assetId,
        operatorSessionId: operatorSessionId || null,
        alertType: 'entry',
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
        alertedAt: now,
      })

      // Track job site visit for work_site geofences
      if (geofence.category === 'work_site') {
        try {
          await recordJobSiteEntry({
            organisationId,
            geofenceId: geofence.id,
            assetId,
            operatorSessionId,
            latitude,
            longitude,
            entryTime: now,
          })
        } catch (error) {
          console.error('Failed to record job site entry:', error)
        }
      }
    }

    // Check for exit
    if (wasInside && !isInside && settings.alertOnExit) {
      alertsToCreate.push({
        organisationId,
        geofenceId: geofence.id,
        assetId,
        operatorSessionId: operatorSessionId || null,
        alertType: 'exit',
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
        alertedAt: now,
      })

      // Track job site visit exit for work_site geofences
      if (geofence.category === 'work_site') {
        try {
          await recordJobSiteExit({
            assetId,
            geofenceId: geofence.id,
            latitude,
            longitude,
            exitTime: now,
          })
        } catch (error) {
          console.error('Failed to record job site exit:', error)
        }
      }
    }

    // Check for after-hours movement (only if inside geofence)
    if (isInside && settings.alertAfterHours && isAfterHours(geofence)) {
      alertsToCreate.push({
        organisationId,
        geofenceId: geofence.id,
        assetId,
        operatorSessionId: operatorSessionId || null,
        alertType: 'after_hours_movement',
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
        alertedAt: now,
      })
    }

    // Insert alerts
    if (alertsToCreate.length > 0) {
      const insertedAlerts = await db
        .insert(schema.geofenceAlerts)
        .values(alertsToCreate)
        .returning()
      alerts.push(...insertedAlerts)

      // Send notifications for each alert
      for (const alert of insertedAlerts) {
        await sendGeofenceNotification(alert, geofence.name, settings)
      }
    }
  }

  return alerts
}

/**
 * Send notifications for a geofence alert
 */
export async function sendGeofenceNotification(
  alert: GeofenceAlert,
  geofenceName: string,
  settings: { notifyByPush: boolean; notifyByEmail: boolean; notifyUserIds: string[] | null },
): Promise<void> {
  // Get asset information
  const asset = await db.query.assets.findFirst({
    where: eq(schema.assets.id, alert.assetId),
    columns: { id: true, assetNumber: true, make: true, model: true },
  })

  if (!asset) return

  const assetLabel = `${asset.assetNumber}${asset.make ? ` (${asset.make}${asset.model ? ` ${asset.model}` : ''})` : ''}`

  // Determine notification type and message based on alert type
  let notificationType: 'geofence_entry' | 'geofence_exit' | 'after_hours_movement'
  let title: string
  let body: string

  switch (alert.alertType) {
    case 'entry':
      notificationType = 'geofence_entry'
      title = 'Geofence Entry Alert'
      body = `${assetLabel} entered ${geofenceName}`
      break
    case 'exit':
      notificationType = 'geofence_exit'
      title = 'Geofence Exit Alert'
      body = `${assetLabel} exited ${geofenceName}`
      break
    case 'after_hours_movement':
      notificationType = 'after_hours_movement'
      title = 'After-Hours Movement Alert'
      body = `${assetLabel} detected moving in ${geofenceName} during after-hours`
      break
    default:
      return
  }

  // Get users to notify
  let userIdsToNotify: string[] = []

  if (settings.notifyUserIds && settings.notifyUserIds.length > 0) {
    // Specific users defined
    userIdsToNotify = settings.notifyUserIds
  } else {
    // Default: notify all admins and fleet managers
    const adminRoles = await db.query.roles.findMany({
      where: inArray(schema.roles.name, ['admin', 'fleet_manager']),
      columns: { id: true },
    })

    const adminRoleIds = adminRoles.map((r) => r.id)

    if (adminRoleIds.length > 0) {
      const admins = await db.query.users.findMany({
        where: and(
          eq(schema.users.organisationId, alert.organisationId),
          eq(schema.users.isActive, true),
          inArray(schema.users.roleId, adminRoleIds),
        ),
        columns: { id: true },
      })
      userIdsToNotify = admins.map((u) => u.id)
    }
  }

  // Create notifications for each user
  if (settings.notifyByPush) {
    for (const userId of userIdsToNotify) {
      await createNotification({
        organisationId: alert.organisationId,
        userId,
        type: notificationType,
        title,
        body,
        link: `/geofence-alerts/${alert.id}`,
        isRead: false,
      })
    }
  }

  // TODO: Implement email notifications when email service is available
  // if (settings.notifyByEmail) {
  //   for (const userId of userIdsToNotify) {
  //     await sendEmailNotification(userId, title, body)
  //   }
  // }
}

/**
 * Initialize geofence position cache for an asset
 * Call this when an operator logs on to prefill the cache
 */
export async function initializeAssetGeofenceState(
  organisationId: string,
  assetId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const geofences = await db.query.geofences.findMany({
    where: and(
      eq(schema.geofences.organisationId, organisationId),
      eq(schema.geofences.isActive, true),
    ),
  })

  const assetCache = getOrCreateAssetPositionCache(assetId)

  for (const geofence of geofences) {
    const isInside = isPointInGeofence(latitude, longitude, geofence)
    assetCache.set(geofence.id, isInside)
  }
}

/**
 * Clear geofence position cache for an asset
 * Call this when an operator logs off
 */
export function clearAssetGeofenceState(assetId: string): void {
  positionCache.delete(assetId)
}
