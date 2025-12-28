import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const updateAlertSettingsSchema = z.object({
  alertOnEntry: z.boolean().optional(),
  alertOnExit: z.boolean().optional(),
  alertAfterHours: z.boolean().optional(),
  notifyByPush: z.boolean().optional(),
  notifyByEmail: z.boolean().optional(),
  notifyUserIds: z.array(z.string().uuid()).nullable().optional(),
})

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

  const body = await readBody(event)
  const result = updateAlertSettingsSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
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

  // Check if settings already exist
  const existingSettings = await db.query.geofenceAlertSettings.findFirst({
    where: and(
      eq(schema.geofenceAlertSettings.geofenceId, geofenceId),
      eq(schema.geofenceAlertSettings.organisationId, session.user.organisationId),
    ),
  })

  const now = new Date()

  if (existingSettings) {
    // Update existing settings
    const [updatedSettings] = await db
      .update(schema.geofenceAlertSettings)
      .set({
        ...result.data,
        updatedAt: now,
      })
      .where(eq(schema.geofenceAlertSettings.id, existingSettings.id))
      .returning()

    // Log audit entry
    await db.insert(schema.auditLog).values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: 'update',
      entityType: 'geofence_alert_settings',
      entityId: existingSettings.id,
      oldValues: existingSettings,
      newValues: updatedSettings,
    })

    return updatedSettings
  }

  // Create new settings
  const insertResult = await db
    .insert(schema.geofenceAlertSettings)
    .values({
      organisationId: session.user.organisationId,
      geofenceId,
      alertOnEntry: result.data.alertOnEntry ?? true,
      alertOnExit: result.data.alertOnExit ?? true,
      alertAfterHours: result.data.alertAfterHours ?? false,
      notifyByPush: result.data.notifyByPush ?? true,
      notifyByEmail: result.data.notifyByEmail ?? false,
      notifyUserIds: result.data.notifyUserIds ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const newSettings = insertResult[0]

  if (!newSettings) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create alert settings',
    })
  }

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'geofence_alert_settings',
    entityId: newSettings.id,
    newValues: newSettings,
  })

  return newSettings
})
