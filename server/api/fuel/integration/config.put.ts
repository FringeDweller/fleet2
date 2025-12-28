import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const configUpdateSchema = z.object({
  // Whether the integration is enabled
  enabled: z.boolean().optional(),
  // How often to auto-sync (in minutes)
  syncIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  // Batch size for sync operations
  syncBatchSize: z.number().int().min(10).max(500).optional(),
  // Number of retry attempts for failed requests
  retryAttempts: z.number().int().min(0).max(10).optional(),
})

/**
 * Update fuel backend integration configuration
 *
 * PUT /api/fuel/integration/config
 *
 * Requires: settings:write permission AND admin role
 *
 * Note: Core settings like API URL and keys are managed via environment variables.
 * This endpoint only updates organisation-specific settings stored in the database.
 */
export default defineEventHandler(async (event) => {
  // Require settings:write permission
  const user = await requirePermission(event, 'settings:write')

  // Additionally require admin role for config changes
  if (!isAdmin(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required to modify integration configuration',
    })
  }

  const body = await readBody(event)
  const result = configUpdateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // If nothing to update, return early
  if (Object.keys(data).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No configuration fields provided to update',
    })
  }

  // Find or create integration health record
  let healthRecord = await db.query.integrationHealth.findFirst({
    where: and(
      eq(schema.integrationHealth.organisationId, user.organisationId),
      eq(schema.integrationHealth.integrationType, 'fuel_backend'),
    ),
  })

  const currentMetadata = healthRecord?.configMetadata || {}
  const updatedMetadata = { ...currentMetadata }

  if (data.syncBatchSize !== undefined) {
    updatedMetadata.syncBatchSize = data.syncBatchSize
  }
  if (data.retryAttempts !== undefined) {
    updatedMetadata.retryAttempts = data.retryAttempts
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.enabled !== undefined) {
    updateData.configEnabled = data.enabled
  }
  if (data.syncIntervalMinutes !== undefined) {
    updateData.configSyncIntervalMinutes = data.syncIntervalMinutes
  }
  if (data.syncBatchSize !== undefined || data.retryAttempts !== undefined) {
    updateData.configMetadata = updatedMetadata
  }

  if (healthRecord) {
    // Update existing record
    await db
      .update(schema.integrationHealth)
      .set(updateData)
      .where(eq(schema.integrationHealth.id, healthRecord.id))

    healthRecord = {
      ...healthRecord,
      ...updateData,
      configMetadata: updatedMetadata,
    } as typeof healthRecord
  } else {
    // Create new record
    const [created] = await db
      .insert(schema.integrationHealth)
      .values({
        organisationId: user.organisationId,
        integrationType: 'fuel_backend',
        integrationName: 'Fuel Backend Integration',
        status: 'unknown',
        configEnabled: data.enabled ?? true,
        configSyncIntervalMinutes: data.syncIntervalMinutes ?? 15,
        configMetadata: updatedMetadata,
      })
      .returning()

    healthRecord = created!
  }

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'fuel_integration_config_updated',
    entityType: 'fuel_integration',
    entityId: healthRecord.id,
    newValues: data,
  })

  return {
    success: true,
    config: {
      enabled: healthRecord.configEnabled,
      syncIntervalMinutes: healthRecord.configSyncIntervalMinutes,
      syncBatchSize: updatedMetadata.syncBatchSize || 100,
      retryAttempts: updatedMetadata.retryAttempts || 3,
    },
    message: 'Configuration updated successfully.',
  }
})
