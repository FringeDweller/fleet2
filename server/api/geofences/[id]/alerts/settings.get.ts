import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const geofenceId = getRouterParam(event, 'id')

  if (!geofenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Geofence ID is required',
    })
  }

  // Verify geofence exists and belongs to the organisation
  const geofence = await db.query.geofences.findFirst({
    where: and(
      eq(schema.geofences.id, geofenceId),
      eq(schema.geofences.organisationId, session.user.organisationId),
    ),
  })

  if (!geofence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Geofence not found',
    })
  }

  // Get alert settings for this geofence
  const settings = await db.query.geofenceAlertSettings.findFirst({
    where: and(
      eq(schema.geofenceAlertSettings.geofenceId, geofenceId),
      eq(schema.geofenceAlertSettings.organisationId, session.user.organisationId),
    ),
  })

  // Return default settings if none exist
  if (!settings) {
    return {
      geofenceId,
      alertOnEntry: true,
      alertOnExit: true,
      alertAfterHours: false,
      notifyByPush: true,
      notifyByEmail: false,
      notifyUserIds: null,
      isDefault: true,
    }
  }

  return {
    ...settings,
    isDefault: false,
  }
})
