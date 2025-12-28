import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../utils/db'
import {
  checkGeofenceAlerts,
  initializeAssetGeofenceState,
} from '../utils/geofence-alert-processor'

const locationCheckSchema = z.object({
  assetId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  operatorSessionId: z.string().uuid().optional().nullable(),
  // Optional: initialize mode skips alert generation, only sets initial state
  initialize: z.boolean().optional().default(false),
})

/**
 * Check location and trigger geofence alerts
 *
 * This endpoint is called by the mobile app when tracking vehicle location.
 * It checks if the vehicle has entered or exited any geofences and creates
 * alerts accordingly.
 *
 * @requirement US-12.5
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = locationCheckSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { assetId, latitude, longitude, operatorSessionId, initialize } = result.data

  // Verify asset exists and belongs to the organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Verify operator session if provided
  if (operatorSessionId) {
    const operatorSession = await db.query.operatorSessions.findFirst({
      where: and(
        eq(schema.operatorSessions.id, operatorSessionId),
        eq(schema.operatorSessions.organisationId, session.user.organisationId),
        eq(schema.operatorSessions.assetId, assetId),
      ),
    })

    if (!operatorSession) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Operator session not found',
      })
    }
  }

  // If initialize mode, just set the initial state without triggering alerts
  if (initialize) {
    await initializeAssetGeofenceState(session.user.organisationId, assetId, latitude, longitude)

    return {
      initialized: true,
      alerts: [],
    }
  }

  // Check geofences and create alerts
  const alerts = await checkGeofenceAlerts(
    session.user.organisationId,
    assetId,
    latitude,
    longitude,
    operatorSessionId,
  )

  return {
    initialized: false,
    alertCount: alerts.length,
    alerts: alerts.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType,
      geofenceId: alert.geofenceId,
      alertedAt: alert.alertedAt,
    })),
  }
})
