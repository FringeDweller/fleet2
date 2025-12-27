import { db, schema } from '../../../utils/db'
import { eq, and } from 'drizzle-orm'
import { generateWorkOrderFromSchedule } from '../../../utils/work-order-generator'

/**
 * POST /api/maintenance-schedules/:id/generate
 *
 * Force-generate work orders for a specific maintenance schedule.
 * This will check all assets associated with the schedule and generate
 * work orders if conditions are met (ignoring if already generated).
 *
 * Useful for:
 * - Testing schedule configurations
 * - Manual triggering outside normal schedule
 * - Recovering from missed generations
 *
 * Returns:
 *   { results: GenerationResult[], summary: { total, created, skipped, errors } }
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const scheduleId = getRouterParam(event, 'id')

  if (!scheduleId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Schedule ID is required'
    })
  }

  try {
    // Fetch the schedule
    const schedule = await db.query.maintenanceSchedules.findFirst({
      where: and(
        eq(schema.maintenanceSchedules.id, scheduleId),
        eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
      )
    })

    if (!schedule) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Schedule not found'
      })
    }

    // Get assets for this schedule
    let assets: Awaited<ReturnType<typeof db.query.assets.findMany>> = []

    if (schedule.assetId) {
      // Schedule is for specific asset
      const asset = await db.query.assets.findFirst({
        where: and(
          eq(schema.assets.id, schedule.assetId),
          eq(schema.assets.organisationId, session.user.organisationId),
          eq(schema.assets.isArchived, false)
        )
      })
      if (asset) assets.push(asset)
    } else if (schedule.categoryId) {
      // Schedule is for all assets in category
      assets = await db.query.assets.findMany({
        where: and(
          eq(schema.assets.categoryId, schedule.categoryId),
          eq(schema.assets.organisationId, session.user.organisationId),
          eq(schema.assets.isArchived, false)
        )
      })
    }

    if (assets.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No eligible assets found for this schedule'
      })
    }

    // Generate work orders for each asset
    const results = []
    for (const asset of assets) {
      const result = await generateWorkOrderFromSchedule(schedule, asset)
      results.push(result)
    }

    // Log the manual generation in audit log
    await db.insert(schema.auditLog).values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: 'execute',
      entityType: 'maintenance_schedule',
      entityId: scheduleId,
      newValues: {
        action: 'manual_work_order_generation',
        scheduleName: schedule.name,
        assetsChecked: assets.length,
        resultsCount: results.length,
        createdCount: results.filter(r => r.status === 'created').length
      }
    })

    return {
      results,
      summary: {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length
      }
    }
  } catch (error) {
    // If it's already a createError, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Otherwise, log and return generic error
    console.error('Error generating work orders for schedule:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate work orders',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
  }
})
