/**
 * PUT /api/fuel/alert-settings
 *
 * Update fuel alert settings for the current organisation.
 * Creates settings if they don't exist (upsert).
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

interface UpdateSettingsBody {
  highConsumptionThreshold?: number
  lowConsumptionThreshold?: number
  criticalThreshold?: number
  minDistanceBetweenRefuels?: number
  enableHighConsumptionAlerts?: boolean
  enableLowConsumptionAlerts?: boolean
  enableRefuelWithoutDistanceAlerts?: boolean
  enableMissingOdometerAlerts?: boolean
  sendEmailNotifications?: boolean
  sendInAppNotifications?: boolean
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const organisationId = session.user.organisationId
  const userId = session.user.id
  const body = await readBody<UpdateSettingsBody>(event)

  // Validate thresholds
  if (body.highConsumptionThreshold !== undefined) {
    if (body.highConsumptionThreshold < 1 || body.highConsumptionThreshold > 200) {
      throw createError({
        statusCode: 400,
        statusMessage: 'High consumption threshold must be between 1 and 200',
      })
    }
  }

  if (body.lowConsumptionThreshold !== undefined) {
    if (body.lowConsumptionThreshold < 1 || body.lowConsumptionThreshold > 200) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Low consumption threshold must be between 1 and 200',
      })
    }
  }

  if (body.criticalThreshold !== undefined) {
    if (body.criticalThreshold < 1 || body.criticalThreshold > 300) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Critical threshold must be between 1 and 300',
      })
    }
  }

  if (body.minDistanceBetweenRefuels !== undefined) {
    if (body.minDistanceBetweenRefuels < 0 || body.minDistanceBetweenRefuels > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Minimum distance between refuels must be between 0 and 1000 km',
      })
    }
  }

  // Check for existing settings
  const [existing] = await db
    .select()
    .from(schema.fuelAlertSettings)
    .where(eq(schema.fuelAlertSettings.organisationId, organisationId))
    .limit(1)

  const now = new Date()

  if (existing) {
    // Update existing settings
    const updateData: Record<string, unknown> = {
      updatedById: userId,
      updatedAt: now,
    }

    if (body.highConsumptionThreshold !== undefined) {
      updateData.highConsumptionThreshold = body.highConsumptionThreshold.toString()
    }
    if (body.lowConsumptionThreshold !== undefined) {
      updateData.lowConsumptionThreshold = body.lowConsumptionThreshold.toString()
    }
    if (body.criticalThreshold !== undefined) {
      updateData.criticalThreshold = body.criticalThreshold.toString()
    }
    if (body.minDistanceBetweenRefuels !== undefined) {
      updateData.minDistanceBetweenRefuels = body.minDistanceBetweenRefuels.toString()
    }
    if (body.enableHighConsumptionAlerts !== undefined) {
      updateData.enableHighConsumptionAlerts = body.enableHighConsumptionAlerts
    }
    if (body.enableLowConsumptionAlerts !== undefined) {
      updateData.enableLowConsumptionAlerts = body.enableLowConsumptionAlerts
    }
    if (body.enableRefuelWithoutDistanceAlerts !== undefined) {
      updateData.enableRefuelWithoutDistanceAlerts = body.enableRefuelWithoutDistanceAlerts
    }
    if (body.enableMissingOdometerAlerts !== undefined) {
      updateData.enableMissingOdometerAlerts = body.enableMissingOdometerAlerts
    }
    if (body.sendEmailNotifications !== undefined) {
      updateData.sendEmailNotifications = body.sendEmailNotifications
    }
    if (body.sendInAppNotifications !== undefined) {
      updateData.sendInAppNotifications = body.sendInAppNotifications
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    const [updated] = await db
      .update(schema.fuelAlertSettings)
      .set(updateData)
      .where(eq(schema.fuelAlertSettings.id, existing.id))
      .returning()

    if (!updated) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update settings',
      })
    }

    return {
      id: updated.id,
      organisationId: updated.organisationId,
      highConsumptionThreshold: parseFloat(updated.highConsumptionThreshold),
      lowConsumptionThreshold: parseFloat(updated.lowConsumptionThreshold),
      criticalThreshold: parseFloat(updated.criticalThreshold),
      minDistanceBetweenRefuels: parseFloat(updated.minDistanceBetweenRefuels),
      enableHighConsumptionAlerts: updated.enableHighConsumptionAlerts,
      enableLowConsumptionAlerts: updated.enableLowConsumptionAlerts,
      enableRefuelWithoutDistanceAlerts: updated.enableRefuelWithoutDistanceAlerts,
      enableMissingOdometerAlerts: updated.enableMissingOdometerAlerts,
      sendEmailNotifications: updated.sendEmailNotifications,
      sendInAppNotifications: updated.sendInAppNotifications,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    }
  } else {
    // Create new settings
    const [created] = await db
      .insert(schema.fuelAlertSettings)
      .values({
        organisationId,
        highConsumptionThreshold: (body.highConsumptionThreshold ?? 30).toString(),
        lowConsumptionThreshold: (body.lowConsumptionThreshold ?? 30).toString(),
        criticalThreshold: (body.criticalThreshold ?? 50).toString(),
        minDistanceBetweenRefuels: (body.minDistanceBetweenRefuels ?? 10).toString(),
        enableHighConsumptionAlerts: body.enableHighConsumptionAlerts ?? true,
        enableLowConsumptionAlerts: body.enableLowConsumptionAlerts ?? true,
        enableRefuelWithoutDistanceAlerts: body.enableRefuelWithoutDistanceAlerts ?? true,
        enableMissingOdometerAlerts: body.enableMissingOdometerAlerts ?? true,
        sendEmailNotifications: body.sendEmailNotifications ?? false,
        sendInAppNotifications: body.sendInAppNotifications ?? true,
        notes: body.notes ?? null,
        updatedById: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!created) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create settings',
      })
    }

    return {
      id: created.id,
      organisationId: created.organisationId,
      highConsumptionThreshold: parseFloat(created.highConsumptionThreshold),
      lowConsumptionThreshold: parseFloat(created.lowConsumptionThreshold),
      criticalThreshold: parseFloat(created.criticalThreshold),
      minDistanceBetweenRefuels: parseFloat(created.minDistanceBetweenRefuels),
      enableHighConsumptionAlerts: created.enableHighConsumptionAlerts,
      enableLowConsumptionAlerts: created.enableLowConsumptionAlerts,
      enableRefuelWithoutDistanceAlerts: created.enableRefuelWithoutDistanceAlerts,
      enableMissingOdometerAlerts: created.enableMissingOdometerAlerts,
      sendEmailNotifications: created.sendEmailNotifications,
      sendInAppNotifications: created.sendInAppNotifications,
      notes: created.notes,
      updatedAt: created.updatedAt,
    }
  }
})
