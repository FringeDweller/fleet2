import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

const logOffSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID').optional(),
  endOdometer: z.number().min(0).optional().nullable(),
  endHours: z.number().min(0).optional().nullable(),
  endLatitude: z.number().min(-90).max(90).optional().nullable(),
  endLongitude: z.number().min(-180).max(180).optional().nullable(),
  endLocationName: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // For offline sync support
  syncStatus: z.enum(['synced', 'pending', 'failed']).optional().default('synced'),
  // Allow passing a custom end time for offline sessions
  endTime: z.string().datetime().optional(),
})

export default defineEventHandler(async (event) => {
  // Require authenticated user
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = logOffSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Find the active session - either by ID or by operator's active session
  let session
  if (data.sessionId) {
    session = await db.query.operatorSessions.findFirst({
      where: and(
        eq(schema.operatorSessions.id, data.sessionId),
        eq(schema.operatorSessions.organisationId, user.organisationId),
        eq(schema.operatorSessions.status, 'active'),
      ),
      with: {
        asset: true,
        operator: true,
      },
    })
  } else {
    // Find the user's current active session
    session = await db.query.operatorSessions.findFirst({
      where: and(
        eq(schema.operatorSessions.operatorId, user.id),
        eq(schema.operatorSessions.status, 'active'),
      ),
      with: {
        asset: true,
        operator: true,
      },
    })
  }

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No active session found',
    })
  }

  // Verify the session belongs to this operator (unless they're admin)
  if (session.operatorId !== user.id && !user.permissions.includes('*')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only log off your own sessions',
    })
  }

  const endTime = data.endTime ? new Date(data.endTime) : new Date()
  const startTime = new Date(session.startTime)

  // Calculate trip metrics
  const tripDurationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

  // Calculate trip distance if odometer readings available
  let tripDistance: number | null = null
  if (data.endOdometer != null && session.startOdometer != null) {
    const startOdo = parseFloat(session.startOdometer)
    tripDistance = data.endOdometer - startOdo
    if (tripDistance < 0) {
      tripDistance = 0 // Guard against invalid readings
    }
  }

  // Update the session
  const updatedSession = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.operatorSessions)
      .set({
        endTime,
        endOdometer: data.endOdometer?.toString() ?? null,
        endHours: data.endHours?.toString() ?? null,
        endLatitude: data.endLatitude?.toString() ?? null,
        endLongitude: data.endLongitude?.toString() ?? null,
        endLocationName: data.endLocationName ?? null,
        tripDistance: tripDistance?.toString() ?? null,
        tripDurationMinutes,
        status: 'completed',
        syncStatus: data.syncStatus,
        notes: data.notes ?? session.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.operatorSessions.id, session.id))
      .returning()

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'operator_log_off',
      entityType: 'operator_session',
      entityId: session.id,
      oldValues: {
        status: 'active',
      },
      newValues: {
        status: 'completed',
        endOdometer: data.endOdometer,
        endHours: data.endHours,
        tripDistance,
        tripDurationMinutes,
        endLatitude: data.endLatitude,
        endLongitude: data.endLongitude,
        endLocationName: data.endLocationName,
      },
    })

    // Update asset with new odometer/hours if provided
    if (data.endOdometer || data.endHours) {
      const assetUpdate: Record<string, unknown> = { updatedAt: new Date() }
      if (data.endOdometer) {
        assetUpdate.mileage = data.endOdometer.toString()
      }
      if (data.endHours) {
        assetUpdate.operationalHours = data.endHours.toString()
      }
      await tx.update(schema.assets).set(assetUpdate).where(eq(schema.assets.id, session.assetId))
    }

    // Optionally update asset location if GPS coordinates provided
    if (data.endLatitude && data.endLongitude) {
      await tx
        .update(schema.assets)
        .set({
          latitude: data.endLatitude.toString(),
          longitude: data.endLongitude.toString(),
          locationName: data.endLocationName ?? undefined,
          lastLocationUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.assets.id, session.assetId))

      // Add to location history
      await tx.insert(schema.assetLocationHistory).values({
        assetId: session.assetId,
        latitude: data.endLatitude.toString(),
        longitude: data.endLongitude.toString(),
        locationName: data.endLocationName ?? null,
        source: 'operator_log_off',
        updatedById: user.id,
        recordedAt: new Date(),
      })
    }

    return updated!
  })

  // Fetch the updated session with relations
  const finalSession = await db.query.operatorSessions.findFirst({
    where: eq(schema.operatorSessions.id, updatedSession.id),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          imageUrl: true,
          mileage: true,
          operationalHours: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  // Format trip duration for display
  const hours = Math.floor(tripDurationMinutes / 60)
  const minutes = tripDurationMinutes % 60
  const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return {
    session: finalSession,
    summary: {
      tripDistance: tripDistance != null ? `${tripDistance.toFixed(1)} km` : null,
      tripDuration: durationFormatted,
      tripDurationMinutes,
      startTime: session.startTime,
      endTime,
      startOdometer: session.startOdometer ? parseFloat(session.startOdometer) : null,
      endOdometer: data.endOdometer ?? null,
      startHours: session.startHours ? parseFloat(session.startHours) : null,
      endHours: data.endHours ?? null,
    },
    message: `Successfully logged off from asset ${session.asset.assetNumber}`,
  }
})
