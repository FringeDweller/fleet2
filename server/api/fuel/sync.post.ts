import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { syncFuelTransactions } from '../../utils/fuel-sync'
import { requirePermission } from '../../utils/permissions'

const syncSchema = z.object({
  // Date range for sync (defaults to last 24 hours if not provided)
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  // Optional: number of days to sync (alternative to explicit dates)
  daysBack: z.number().int().min(1).max(90).optional().default(1),
  // Batch size for pagination
  batchSize: z.number().int().min(10).max(500).optional().default(100),
  // Whether to skip already imported transactions
  skipDuplicates: z.boolean().optional().default(true),
})

/**
 * Trigger a manual sync of fuel transactions from the external backend
 *
 * POST /api/fuel/sync
 *
 * Requires: settings:write permission
 */
export default defineEventHandler(async (event) => {
  // Require settings:write permission for triggering sync
  const user = await requirePermission(event, 'settings:write')

  const body = await readBody(event)
  const result = syncSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Calculate date range
  let fromDate: Date
  let toDate: Date

  if (data.fromDate && data.toDate) {
    fromDate = new Date(data.fromDate)
    toDate = new Date(data.toDate)
  } else {
    // Default to last N days
    toDate = new Date()
    fromDate = new Date(toDate.getTime() - data.daysBack * 24 * 60 * 60 * 1000)
  }

  // Validate date range
  if (fromDate >= toDate) {
    throw createError({
      statusCode: 400,
      statusMessage: 'fromDate must be before toDate',
    })
  }

  // Don't allow syncing more than 90 days at once
  const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 90) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot sync more than 90 days at once',
    })
  }

  // Run the sync
  const syncResult = await syncFuelTransactions({
    fromDate,
    toDate,
    organisationId: user.organisationId,
    batchSize: data.batchSize,
    skipDuplicates: data.skipDuplicates,
    triggeredBy: user.id,
  })

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'fuel_sync_triggered',
    entityType: 'fuel_integration',
    entityId: user.organisationId,
    newValues: {
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      batchSize: data.batchSize,
      result: {
        success: syncResult.success,
        recordsFetched: syncResult.recordsFetched,
        recordsCreated: syncResult.recordsCreated,
        recordsSkipped: syncResult.recordsSkipped,
        discrepanciesFound: syncResult.discrepanciesFound,
        durationMs: syncResult.durationMs,
      },
    },
  })

  return {
    success: syncResult.success,
    syncWindow: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
    summary: {
      recordsFetched: syncResult.recordsFetched,
      recordsCreated: syncResult.recordsCreated,
      recordsUpdated: syncResult.recordsUpdated,
      recordsSkipped: syncResult.recordsSkipped,
      recordsWithErrors: syncResult.recordsWithErrors,
      discrepanciesFound: syncResult.discrepanciesFound,
      durationMs: syncResult.durationMs,
    },
    errors: syncResult.errors.length > 0 ? syncResult.errors.slice(0, 10) : undefined,
    message: syncResult.success
      ? `Sync completed. Created ${syncResult.recordsCreated} transactions, found ${syncResult.discrepanciesFound} discrepancies.`
      : `Sync failed: ${syncResult.errors[0]?.error || 'Unknown error'}`,
  }
})
