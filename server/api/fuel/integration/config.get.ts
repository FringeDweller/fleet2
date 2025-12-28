import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { getFuelBackendClient, maskConfig } from '../../../utils/fuel-backend-client'
import { requirePermission } from '../../../utils/permissions'

/**
 * Get the current fuel backend integration configuration (masked)
 *
 * GET /api/fuel/integration/config
 *
 * Requires: settings:read permission
 *
 * Returns masked configuration values - API keys are partially hidden for security.
 */
export default defineEventHandler(async (event) => {
  // Require settings:read permission
  const user = await requirePermission(event, 'settings:read')

  // Get client configuration
  const client = getFuelBackendClient()
  const clientConfig = client.getConfig()
  const isConfigured = client.isConfigured()

  // Get organisation-specific settings from database
  const healthRecord = await db.query.integrationHealth.findFirst({
    where: and(
      eq(schema.integrationHealth.organisationId, user.organisationId),
      eq(schema.integrationHealth.integrationType, 'fuel_backend'),
    ),
    columns: {
      configEnabled: true,
      configSyncIntervalMinutes: true,
      configMetadata: true,
    },
  })

  return {
    configured: isConfigured,
    clientConfig: {
      baseUrl: clientConfig.baseUrl || null,
      apiKey: clientConfig.apiKey || null, // Already masked by maskConfig
      apiSecret: clientConfig.apiSecret || null, // Already masked
      timeoutMs: clientConfig.timeoutMs,
      maxRetries: clientConfig.maxRetries,
      retryDelayMs: clientConfig.retryDelayMs,
      externalOrgId: clientConfig.externalOrgId || null,
    },
    organisationConfig: healthRecord
      ? {
          enabled: healthRecord.configEnabled,
          syncIntervalMinutes: healthRecord.configSyncIntervalMinutes,
          syncBatchSize: healthRecord.configMetadata?.syncBatchSize || 100,
          retryAttempts: healthRecord.configMetadata?.retryAttempts || 3,
        }
      : {
          enabled: true,
          syncIntervalMinutes: 15,
          syncBatchSize: 100,
          retryAttempts: 3,
        },
    environmentVariables: {
      // Show which env vars are set (but not their values)
      FUEL_BACKEND_URL: !!process.env.FUEL_BACKEND_URL,
      FUEL_BACKEND_API_KEY: !!process.env.FUEL_BACKEND_API_KEY,
      FUEL_BACKEND_API_SECRET: !!process.env.FUEL_BACKEND_API_SECRET,
      FUEL_BACKEND_TIMEOUT_MS: !!process.env.FUEL_BACKEND_TIMEOUT_MS,
      FUEL_BACKEND_MAX_RETRIES: !!process.env.FUEL_BACKEND_MAX_RETRIES,
      FUEL_BACKEND_ORG_ID: !!process.env.FUEL_BACKEND_ORG_ID,
    },
    message: isConfigured
      ? 'Integration is configured. Core settings are managed via environment variables.'
      : 'Integration is not configured. Set required environment variables: FUEL_BACKEND_URL and FUEL_BACKEND_API_KEY.',
  }
})
