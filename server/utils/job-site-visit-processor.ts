import { and, eq } from 'drizzle-orm'
import type { JobSiteVisit, NewJobSiteVisit } from '../db/schema/job-site-visits'
import { db, schema } from './db'

/**
 * Record a vehicle entry to a job site geofence
 *
 * Creates a new job site visit record with 'in_progress' status.
 * Called when a vehicle enters a geofence with category 'work_site'.
 *
 * @requirement REQ-1206-AC-02
 */
export async function recordJobSiteEntry(params: {
  organisationId: string
  geofenceId: string
  assetId: string
  operatorSessionId?: string | null
  latitude: number
  longitude: number
  entryTime?: Date
}): Promise<JobSiteVisit> {
  const { organisationId, geofenceId, assetId, operatorSessionId, latitude, longitude, entryTime } =
    params

  // Check if there's already an in-progress visit for this asset at this geofence
  const existingVisit = await db.query.jobSiteVisits.findFirst({
    where: and(
      eq(schema.jobSiteVisits.assetId, assetId),
      eq(schema.jobSiteVisits.geofenceId, geofenceId),
      eq(schema.jobSiteVisits.status, 'in_progress'),
    ),
  })

  // If already in-progress, return existing visit
  if (existingVisit) {
    return existingVisit
  }

  // Create new visit record
  const [visit] = await db
    .insert(schema.jobSiteVisits)
    .values({
      organisationId,
      geofenceId,
      assetId,
      operatorSessionId: operatorSessionId || null,
      status: 'in_progress',
      entryTime: entryTime || new Date(),
      entryLatitude: latitude.toFixed(7),
      entryLongitude: longitude.toFixed(7),
    })
    .returning()

  if (!visit) {
    throw new Error('Failed to create job site visit record')
  }

  return visit
}

/**
 * Record a vehicle exit from a job site geofence
 *
 * Updates the existing in-progress visit with exit time and duration.
 * Called when a vehicle exits a geofence with category 'work_site'.
 *
 * @requirement REQ-1206-AC-02
 * @requirement REQ-1206-AC-03
 */
export async function recordJobSiteExit(params: {
  assetId: string
  geofenceId: string
  latitude: number
  longitude: number
  exitTime?: Date
}): Promise<JobSiteVisit | null> {
  const { assetId, geofenceId, latitude, longitude, exitTime } = params

  // Find the in-progress visit
  const existingVisit = await db.query.jobSiteVisits.findFirst({
    where: and(
      eq(schema.jobSiteVisits.assetId, assetId),
      eq(schema.jobSiteVisits.geofenceId, geofenceId),
      eq(schema.jobSiteVisits.status, 'in_progress'),
    ),
  })

  if (!existingVisit) {
    // No in-progress visit to close
    return null
  }

  const actualExitTime = exitTime || new Date()
  const entryTime = new Date(existingVisit.entryTime)

  // Calculate duration in minutes
  const durationMs = actualExitTime.getTime() - entryTime.getTime()
  const durationMinutes = Math.round(durationMs / (1000 * 60))

  // Update the visit with exit information
  const [updatedVisit] = await db
    .update(schema.jobSiteVisits)
    .set({
      status: 'completed',
      exitTime: actualExitTime,
      exitLatitude: latitude.toFixed(7),
      exitLongitude: longitude.toFixed(7),
      durationMinutes,
      updatedAt: new Date(),
    })
    .where(eq(schema.jobSiteVisits.id, existingVisit.id))
    .returning()

  return updatedVisit || null
}

/**
 * Check if a geofence is a job site (work_site category)
 */
export async function isJobSiteGeofence(geofenceId: string): Promise<boolean> {
  const geofence = await db.query.geofences.findFirst({
    where: eq(schema.geofences.id, geofenceId),
    columns: { category: true },
  })

  return geofence?.category === 'work_site'
}

/**
 * Get current in-progress visits for an asset
 */
export async function getInProgressVisitsForAsset(assetId: string): Promise<JobSiteVisit[]> {
  return db.query.jobSiteVisits.findMany({
    where: and(
      eq(schema.jobSiteVisits.assetId, assetId),
      eq(schema.jobSiteVisits.status, 'in_progress'),
    ),
  })
}

/**
 * Close all in-progress visits for an asset (used when operator logs off)
 * Uses the current time and last known position as exit data.
 */
export async function closeAllInProgressVisits(params: {
  assetId: string
  latitude: number
  longitude: number
  exitTime?: Date
}): Promise<JobSiteVisit[]> {
  const { assetId, latitude, longitude, exitTime } = params

  const inProgressVisits = await getInProgressVisitsForAsset(assetId)

  if (inProgressVisits.length === 0) {
    return []
  }

  const closedVisits: JobSiteVisit[] = []
  const actualExitTime = exitTime || new Date()

  for (const visit of inProgressVisits) {
    const entryTime = new Date(visit.entryTime)
    const durationMs = actualExitTime.getTime() - entryTime.getTime()
    const durationMinutes = Math.round(durationMs / (1000 * 60))

    const [updatedVisit] = await db
      .update(schema.jobSiteVisits)
      .set({
        status: 'completed',
        exitTime: actualExitTime,
        exitLatitude: latitude.toFixed(7),
        exitLongitude: longitude.toFixed(7),
        durationMinutes,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobSiteVisits.id, visit.id))
      .returning()

    if (updatedVisit) {
      closedVisits.push(updatedVisit)
    }
  }

  return closedVisits
}
