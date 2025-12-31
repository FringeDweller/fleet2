/**
 * US-15.6: Get document expiry summary for dashboard widget
 * GET /api/documents/expiry-summary
 *
 * Returns a summary of document expiry status for the current organisation.
 * Useful for dashboard widgets showing expiring document counts.
 */

import { getExpiryDashboardSummary } from '../../utils/document-expiry-checker'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission to view expiry summary
  const currentUser = await requirePermission(event, 'assets:read')

  const summary = await getExpiryDashboardSummary(currentUser.organisationId)

  return {
    ...summary,
    // Include breakdown by urgency level for dashboard display
    urgencyBreakdown: {
      expired: {
        count: summary.expiredCount,
        label: 'Expired',
        color: 'red',
      },
      critical: {
        count: summary.criticalCount,
        label: 'Expiring within 7 days',
        color: 'red',
      },
      warning: {
        count: summary.warningCount,
        label: 'Expiring in 8-14 days',
        color: 'orange',
      },
      info: {
        count: summary.infoCount,
        label: 'Expiring in 15-30 days',
        color: 'yellow',
      },
    },
  }
})
