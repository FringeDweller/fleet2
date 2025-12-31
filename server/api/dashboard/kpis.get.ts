import { and, count, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

interface KpiData {
  totalAssets: number
  activeWorkOrders: number
  overdueMaintenanceCount: number
  complianceRate: number
  previousPeriod: {
    totalAssets: number
    activeWorkOrders: number
    overdueMaintenanceCount: number
    complianceRate: number
  }
}

/**
 * Dashboard KPIs endpoint
 * Returns real-time KPIs for the fleet management dashboard:
 * - Total Assets: count of active (non-archived) assets
 * - Active Work Orders: count of open/in_progress work orders
 * - Overdue Maintenance: work orders past due date that are not completed/closed
 * - Compliance Rate: percentage of work orders completed on time
 */
export default defineEventHandler(async (event): Promise<KpiData> => {
  // Require at least read permission for assets (dashboard access)
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)
  const now = new Date()

  // Parse date range from query params
  const endDate = query.endDate ? new Date(query.endDate as string) : now
  const startDate = query.startDate
    ? new Date(query.startDate as string)
    : new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000) // Default 14 days

  // Calculate previous period (same duration before the start date)
  const periodDuration = endDate.getTime() - startDate.getTime()
  const previousPeriodEnd = new Date(startDate.getTime())
  const previousPeriodStart = new Date(startDate.getTime() - periodDuration)

  // 1. Total Assets - Count of active (non-archived) assets
  const [totalAssetsResult] = await db
    .select({ count: count() })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assets.isArchived, false),
        eq(schema.assets.status, 'active'),
      ),
    )
  const totalAssets = totalAssetsResult?.count ?? 0

  // Previous period total assets - assets that existed before the previous period end
  const [previousTotalAssetsResult] = await db
    .select({ count: count() })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assets.isArchived, false),
        eq(schema.assets.status, 'active'),
        lte(schema.assets.createdAt, previousPeriodEnd),
      ),
    )
  const previousTotalAssets = previousTotalAssetsResult?.count ?? 0

  // 2. Active Work Orders - Count of open or in_progress work orders
  const activeStatuses = ['open', 'in_progress'] as const
  const [activeWorkOrdersResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, activeStatuses),
      ),
    )
  const activeWorkOrders = activeWorkOrdersResult?.count ?? 0

  // Previous period active work orders (active as of previous period end)
  const [previousActiveWorkOrdersResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, activeStatuses),
        lte(schema.workOrders.createdAt, previousPeriodEnd),
      ),
    )
  const previousActiveWorkOrders = previousActiveWorkOrdersResult?.count ?? 0

  // 3. Overdue Maintenance - Work orders past due date that are not completed/closed
  const nonCompletedStatuses = [
    'draft',
    'pending_approval',
    'open',
    'in_progress',
    'pending_parts',
  ] as const
  const [overdueResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, nonCompletedStatuses),
        lt(schema.workOrders.dueDate, now),
      ),
    )
  const overdueMaintenanceCount = overdueResult?.count ?? 0

  // Previous period overdue (as of previous period end)
  const [previousOverdueResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, nonCompletedStatuses),
        lt(schema.workOrders.dueDate, previousPeriodEnd),
        lte(schema.workOrders.createdAt, previousPeriodEnd),
      ),
    )
  const previousOverdueMaintenanceCount = previousOverdueResult?.count ?? 0

  // 4. Compliance Rate - Percentage of completed work orders that were completed on time
  // Current period: WOs completed within the selected date range
  const completedStatuses = ['completed', 'closed'] as const

  // Work orders completed in the current period
  const [completedOnTimeResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, completedStatuses),
        gte(schema.workOrders.completedAt, startDate),
        lte(schema.workOrders.completedAt, endDate),
        // Completed on time: completedAt <= dueDate (or no due date)
        sql`(${schema.workOrders.completedAt} <= ${schema.workOrders.dueDate} OR ${schema.workOrders.dueDate} IS NULL)`,
      ),
    )
  const completedOnTime = completedOnTimeResult?.count ?? 0

  const [totalCompletedResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, completedStatuses),
        gte(schema.workOrders.completedAt, startDate),
        lte(schema.workOrders.completedAt, endDate),
      ),
    )
  const totalCompleted = totalCompletedResult?.count ?? 0

  // Calculate compliance rate (default to 100% if no completed work orders)
  const complianceRate =
    totalCompleted > 0 ? Math.round((completedOnTime / totalCompleted) * 100) : 100

  // Previous period compliance
  const [previousCompletedOnTimeResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, completedStatuses),
        gte(schema.workOrders.completedAt, previousPeriodStart),
        lte(schema.workOrders.completedAt, previousPeriodEnd),
        sql`(${schema.workOrders.completedAt} <= ${schema.workOrders.dueDate} OR ${schema.workOrders.dueDate} IS NULL)`,
      ),
    )
  const previousCompletedOnTime = previousCompletedOnTimeResult?.count ?? 0

  const [previousTotalCompletedResult] = await db
    .select({ count: count() })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, completedStatuses),
        gte(schema.workOrders.completedAt, previousPeriodStart),
        lte(schema.workOrders.completedAt, previousPeriodEnd),
      ),
    )
  const previousTotalCompleted = previousTotalCompletedResult?.count ?? 0

  const previousComplianceRate =
    previousTotalCompleted > 0
      ? Math.round((previousCompletedOnTime / previousTotalCompleted) * 100)
      : 100

  return {
    totalAssets,
    activeWorkOrders,
    overdueMaintenanceCount,
    complianceRate,
    previousPeriod: {
      totalAssets: previousTotalAssets,
      activeWorkOrders: previousActiveWorkOrders,
      overdueMaintenanceCount: previousOverdueMaintenanceCount,
      complianceRate: previousComplianceRate,
    },
  }
})
