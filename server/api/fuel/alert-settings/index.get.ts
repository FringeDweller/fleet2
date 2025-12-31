/**
 * GET /api/fuel/alert-settings
 *
 * Get fuel alert settings for the current organisation.
 * Returns default settings if no custom settings exist.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const organisationId = session.user.organisationId

  // Try to find existing settings
  const [settings] = await db
    .select()
    .from(schema.fuelAlertSettings)
    .where(eq(schema.fuelAlertSettings.organisationId, organisationId))
    .limit(1)

  // Return existing settings or default values
  if (settings) {
    return {
      id: settings.id,
      organisationId: settings.organisationId,
      highConsumptionThreshold: parseFloat(settings.highConsumptionThreshold),
      lowConsumptionThreshold: parseFloat(settings.lowConsumptionThreshold),
      criticalThreshold: parseFloat(settings.criticalThreshold),
      minDistanceBetweenRefuels: parseFloat(settings.minDistanceBetweenRefuels),
      enableHighConsumptionAlerts: settings.enableHighConsumptionAlerts,
      enableLowConsumptionAlerts: settings.enableLowConsumptionAlerts,
      enableRefuelWithoutDistanceAlerts: settings.enableRefuelWithoutDistanceAlerts,
      enableMissingOdometerAlerts: settings.enableMissingOdometerAlerts,
      sendEmailNotifications: settings.sendEmailNotifications,
      sendInAppNotifications: settings.sendInAppNotifications,
      notes: settings.notes,
      updatedAt: settings.updatedAt,
    }
  }

  // Return default settings
  return {
    id: null,
    organisationId,
    highConsumptionThreshold: 30,
    lowConsumptionThreshold: 30,
    criticalThreshold: 50,
    minDistanceBetweenRefuels: 10,
    enableHighConsumptionAlerts: true,
    enableLowConsumptionAlerts: true,
    enableRefuelWithoutDistanceAlerts: true,
    enableMissingOdometerAlerts: true,
    sendEmailNotifications: false,
    sendInAppNotifications: true,
    notes: null,
    updatedAt: null,
  }
})
