/**
 * Nitro scheduled task to generate work orders from maintenance schedules
 *
 * This task runs periodically to check all active maintenance schedules and
 * generate work orders when they are due based on time-based or usage-based criteria.
 *
 * Schedule:
 * - Time-based: Triggers when (nextDueDate - leadTimeDays) <= today
 * - Usage-based: Triggers when asset mileage/hours >= next trigger point
 * - Combined: Triggers when either condition is met
 *
 * Run manually:
 * npx nuxi build
 * node .output/server/index.mjs --task=maintenance:generate-work-orders
 *
 * Or via API:
 * POST /api/maintenance-schedules/generate
 */

import { generateScheduledWorkOrders } from '../utils/work-order-generator'

export default defineTask({
  meta: {
    name: 'maintenance:generate-work-orders',
    description: 'Generate work orders from maintenance schedules'
  },
  async run() {
    console.log('[Task] Starting scheduled work order generation...')

    try {
      const results = await generateScheduledWorkOrders()

      const summary = {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results: results.filter(r => r.status === 'created' || r.status === 'error')
      }

      console.log(`[Task] Work order generation complete:`)
      console.log(`  Total schedules checked: ${summary.total}`)
      console.log(`  Work orders created: ${summary.created}`)
      console.log(`  Skipped (not due): ${summary.skipped}`)
      console.log(`  Errors: ${summary.errors}`)

      if (summary.created > 0) {
        console.log('\nCreated work orders:')
        summary.results
          .filter(r => r.status === 'created')
          .forEach((r) => {
            console.log(`  - ${r.workOrderNumber} for ${r.assetNumber} (${r.scheduleName})`)
          })
      }

      if (summary.errors > 0) {
        console.error('\nErrors:')
        summary.results
          .filter(r => r.status === 'error')
          .forEach((r) => {
            console.error(`  - ${r.scheduleName}: ${r.reason}`)
          })
      }

      return { result: summary }
    } catch (error) {
      console.error('[Task] Fatal error during work order generation:', error)
      throw error
    }
  }
})
