import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'
import {
  generateScheduledWorkOrders,
  generateWorkOrderFromSchedule
} from '../../utils/work-order-generator'

const generateSchema = z
  .object({
    scheduleId: z.string().uuid().optional()
  })
  .optional()

/**
 * POST /api/maintenance-schedules/generate
 *
 * Manually trigger work order generation from maintenance schedules.
 *
 * Body (optional):
 *   { scheduleId: string } - Generate for specific schedule only
 *   {} or null - Generate for all active schedules
 *
 * Returns:
 *   { results: GenerationResult[] }
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Parse request body (optional)
  const body = await readBody(event).catch(() => ({}))
  const validation = generateSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: validation.error.flatten()
    })
  }

  try {
    let results

    if (validation.data?.scheduleId) {
      // Generate for specific schedule
      const schedule = await db.query.maintenanceSchedules.findFirst({
        where: and(
          eq(schema.maintenanceSchedules.id, validation.data.scheduleId),
          eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
        )
      })

      if (!schedule) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Schedule not found'
        })
      }

      if (!schedule.isActive || schedule.isArchived) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Schedule is not active'
        })
      }

      // Get assets for this schedule
      let assets: Awaited<ReturnType<typeof db.query.assets.findMany>> = []
      if (schedule.assetId) {
        const asset = await db.query.assets.findFirst({
          where: and(
            eq(schema.assets.id, schedule.assetId),
            eq(schema.assets.organisationId, session.user.organisationId),
            eq(schema.assets.isArchived, false)
          )
        })
        if (asset) assets.push(asset)
      } else if (schedule.categoryId) {
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

      results = []
      for (const asset of assets) {
        const result = await generateWorkOrderFromSchedule(schedule, asset)
        results.push(result)
      }
    } else {
      // Generate for all active schedules in this organisation
      // Filter results to only this org's schedules
      const allResults = await generateScheduledWorkOrders()

      // Get all schedules for this org to filter results
      const orgSchedules = await db.query.maintenanceSchedules.findMany({
        where: eq(schema.maintenanceSchedules.organisationId, session.user.organisationId),
        columns: { id: true }
      })

      const orgScheduleIds = new Set(orgSchedules.map(s => s.id))
      results = allResults.filter(r => orgScheduleIds.has(r.scheduleId))
    }

    // Log the manual generation in audit log
    await db.insert(schema.auditLog).values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: 'execute',
      entityType: 'maintenance_schedule',
      entityId: validation.data?.scheduleId || null,
      newValues: {
        action: 'manual_work_order_generation',
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
    console.error('Error generating work orders:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate work orders',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
  }
})
