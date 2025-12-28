import type { Geofence } from '../db/schema/geofences'

/**
 * Check if a point is inside a geofence (circle or polygon)
 */
export function isPointInGeofence(lat: number, lng: number, geofence: Geofence): boolean {
  if (geofence.type === 'circle') {
    return isPointInCircle(lat, lng, geofence)
  }
  return isPointInPolygon(lat, lng, geofence)
}

/**
 * Check if a point is inside a circle geofence
 */
function isPointInCircle(lat: number, lng: number, geofence: Geofence): boolean {
  if (!geofence.centerLatitude || !geofence.centerLongitude || !geofence.radiusMeters) {
    return false
  }

  const centerLat = parseFloat(geofence.centerLatitude)
  const centerLng = parseFloat(geofence.centerLongitude)
  const radius = parseFloat(geofence.radiusMeters)

  const distance = calculateDistance(lat, lng, centerLat, centerLng)
  return distance <= radius
}

/**
 * Check if a point is inside a polygon geofence using ray casting algorithm
 */
function isPointInPolygon(lat: number, lng: number, geofence: Geofence): boolean {
  if (!geofence.polygonCoordinates || geofence.polygonCoordinates.length < 3) {
    return false
  }

  const polygon = geofence.polygonCoordinates
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

    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Calculate the distance between two points in meters using the Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Check if a geofence is currently active based on time and day
 */
export function isGeofenceActive(geofence: Geofence, date: Date = new Date()): boolean {
  // If geofence is disabled, it's not active
  if (!geofence.isActive) {
    return false
  }

  // If no active hours set, it's always active
  if (!geofence.activeStartTime && !geofence.activeEndTime && !geofence.activeDays) {
    return true
  }

  // Check active days
  if (geofence.activeDays && geofence.activeDays.length > 0) {
    const dayOfWeek = date.getDay() // 0-6 for Sun-Sat
    if (!geofence.activeDays.includes(dayOfWeek)) {
      return false
    }
  }

  // Check active time window
  if (geofence.activeStartTime && geofence.activeEndTime) {
    const currentTime = formatTime(date)

    // Handle time ranges that cross midnight
    if (geofence.activeStartTime <= geofence.activeEndTime) {
      // Normal time range (e.g., 09:00 to 17:00)
      if (currentTime < geofence.activeStartTime || currentTime > geofence.activeEndTime) {
        return false
      }
    } else {
      // Overnight time range (e.g., 22:00 to 06:00)
      if (currentTime < geofence.activeStartTime && currentTime > geofence.activeEndTime) {
        return false
      }
    }
  }

  return true
}

/**
 * Format a date to HH:MM:SS time string
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Validate polygon coordinates
 */
export function validatePolygonCoordinates(
  coordinates: { lat: number; lng: number }[] | null | undefined,
): boolean {
  if (!coordinates || coordinates.length < 3) {
    return false
  }

  return coordinates.every(
    (coord) =>
      typeof coord.lat === 'number' &&
      typeof coord.lng === 'number' &&
      coord.lat >= -90 &&
      coord.lat <= 90 &&
      coord.lng >= -180 &&
      coord.lng <= 180,
  )
}

/**
 * Validate circle geofence parameters
 */
export function validateCircleGeofence(
  centerLat: number | null | undefined,
  centerLng: number | null | undefined,
  radius: number | null | undefined,
): boolean {
  if (centerLat === null || centerLat === undefined) return false
  if (centerLng === null || centerLng === undefined) return false
  if (radius === null || radius === undefined) return false

  return (
    centerLat >= -90 &&
    centerLat <= 90 &&
    centerLng >= -180 &&
    centerLng <= 180 &&
    radius > 0 &&
    radius <= 100000 // Max 100km radius
  )
}

/**
 * Calculate the bounding box of a geofence for efficient queries
 */
export function getGeofenceBoundingBox(geofence: Geofence): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
} | null {
  if (geofence.type === 'circle') {
    if (!geofence.centerLatitude || !geofence.centerLongitude || !geofence.radiusMeters) {
      return null
    }

    const centerLat = parseFloat(geofence.centerLatitude)
    const centerLng = parseFloat(geofence.centerLongitude)
    const radius = parseFloat(geofence.radiusMeters)

    // Approximate bounding box (1 degree of latitude ~ 111km)
    const latOffset = radius / 111000
    const lngOffset = radius / (111000 * Math.cos(toRadians(centerLat)))

    return {
      minLat: centerLat - latOffset,
      maxLat: centerLat + latOffset,
      minLng: centerLng - lngOffset,
      maxLng: centerLng + lngOffset,
    }
  }

  if (geofence.polygonCoordinates && geofence.polygonCoordinates.length > 0) {
    const lats = geofence.polygonCoordinates.map((c) => c.lat)
    const lngs = geofence.polygonCoordinates.map((c) => c.lng)

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    }
  }

  return null
}
