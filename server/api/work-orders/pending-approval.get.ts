import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { isManager, requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Check if user is manager or above to see all pending approvals
  // Regular users can only see their own requests
  const canViewAll = isManager(user)

  // Get pending approvals with work order and requester details
  const pendingApprovals = await db.query.workOrderApprovals.findMany({
    where: and(
      eq(schema.workOrderApprovals.organisationId, user.organisationId),
      eq(schema.workOrderApprovals.status, 'pending'),
      // If not manager, only show user's own requests
      ...(canViewAll ? [] : [eq(schema.workOrderApprovals.requestedById, user.id)]),
    ),
    with: {
      workOrder: {
        with: {
          asset: {
            columns: {
              id: true,
              assetNumber: true,
              make: true,
              model: true,
            },
          },
          assignee: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      requestedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [desc(schema.workOrderApprovals.requestedAt)],
  })

  return {
    approvals: pendingApprovals,
    canApprove: canViewAll,
    total: pendingApprovals.length,
  }
})
