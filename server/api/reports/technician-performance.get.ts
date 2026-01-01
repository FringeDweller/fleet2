/**
 * Technician Performance Report API (US-14.5)
 *
 * GET /api/reports/technician-performance
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - technicianId: (optional) filter by specific technician
 * - groupBy: (optional) day, week, month - for trend data (default: month)
 *
 * Returns:
 * - technicians: array of technician performance metrics
 * - summary: overall summary statistics
 * - trendData: performance over time for charts
 *
 * Metrics per technician:
 * - completedCount: count of completed work orders
 * - avgCompletionTime: average hours from created to completed
 * - avgCustomerRating: average customer satisfaction rating (1-5 scale)
 * - firstTimeFixRate: percentage of WOs without rework (same asset within 30 days)
 * - reworkRate: percentage of WOs that required rework (quality score - lower is better)
 *
 * Access: Admin/Manager only (requires reports:read permission)
 */

import { and, desc, eq, gte, isNotNull, lte, type SQL, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

// Rework window: work orders on same asset within this many days are considered rework
const REWORK_WINDOW_DAYS = 30

export default defineEventHandler(async (event) => {
  // Require reports:read permission
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const technicianId = query.technicianId as string | undefined
  const groupBy = (query.groupBy as string) || 'month'

  // Build base conditions for work orders
  const workOrderConditions: SQL[] = [
    eq(schema.workOrders.organisationId, user.organisationId),
    eq(schema.workOrders.status, 'completed'),
    isNotNull(schema.workOrders.assignedToId),
    isNotNull(schema.workOrders.completedAt),
  ]

  // Add date range filters
  if (startDate) {
    workOrderConditions.push(gte(schema.workOrders.completedAt, new Date(startDate)))
  }

  if (endDate) {
    workOrderConditions.push(lte(schema.workOrders.completedAt, new Date(endDate)))
  }

  // Add technician filter
  if (technicianId) {
    workOrderConditions.push(eq(schema.workOrders.assignedToId, technicianId))
  }

  const whereClause = and(...workOrderConditions)

  // Get per-technician metrics
  const technicianMetricsResult = await db
    .select({
      technicianId: schema.workOrders.assignedToId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
      completedCount: sql<number>`count(*)::int`,
      avgCompletionHours: sql<number>`
        avg(
          extract(epoch from (${schema.workOrders.completedAt} - ${schema.workOrders.createdAt})) / 3600
        )::numeric
      `,
      // Customer rating metrics (1-5 scale)
      avgCustomerRating: sql<number>`
        avg(${schema.workOrders.customerRating})::numeric
      `,
      ratedCount: sql<number>`
        count(${schema.workOrders.customerRating})::int
      `,
      totalLaborCost: sql<number>`coalesce(sum(${schema.workOrders.laborCost}), 0)::numeric`,
      totalPartsCost: sql<number>`coalesce(sum(${schema.workOrders.partsCost}), 0)::numeric`,
      totalCost: sql<number>`coalesce(sum(${schema.workOrders.totalCost}), 0)::numeric`,
    })
    .from(schema.workOrders)
    .innerJoin(schema.users, eq(schema.workOrders.assignedToId, schema.users.id))
    .where(whereClause)
    .groupBy(
      schema.workOrders.assignedToId,
      schema.users.firstName,
      schema.users.lastName,
      schema.users.email,
    )
    .orderBy(desc(sql`count(*)`))

  // Calculate rework for each technician
  // Rework is defined as: a work order completed on the same asset within REWORK_WINDOW_DAYS
  // after another completed work order by the same technician

  // Build conditions for rework subquery
  const reworkConditions: SQL[] = [
    eq(schema.workOrders.organisationId, user.organisationId),
    eq(schema.workOrders.status, 'completed'),
    isNotNull(schema.workOrders.assignedToId),
    isNotNull(schema.workOrders.completedAt),
  ]

  if (startDate) {
    reworkConditions.push(gte(schema.workOrders.completedAt, new Date(startDate)))
  }

  if (endDate) {
    reworkConditions.push(lte(schema.workOrders.completedAt, new Date(endDate)))
  }

  if (technicianId) {
    reworkConditions.push(eq(schema.workOrders.assignedToId, technicianId))
  }

  // Get work orders that are rework (completed on same asset within 30 days of a prior WO by same technician)
  const reworkQuery = await db.execute<{
    technician_id: string
    rework_count: string
  }>(sql`
    WITH wo_with_prior AS (
      SELECT
        wo.id,
        wo.assigned_to_id as technician_id,
        wo.asset_id,
        wo.completed_at,
        EXISTS (
          SELECT 1 FROM work_orders prior_wo
          WHERE prior_wo.organisation_id = ${user.organisationId}
            AND prior_wo.status = 'completed'
            AND prior_wo.assigned_to_id = wo.assigned_to_id
            AND prior_wo.asset_id = wo.asset_id
            AND prior_wo.completed_at IS NOT NULL
            AND prior_wo.completed_at < wo.completed_at
            AND prior_wo.completed_at >= wo.completed_at - interval '${sql.raw(String(REWORK_WINDOW_DAYS))} days'
            AND prior_wo.id != wo.id
        ) as is_rework
      FROM work_orders wo
      WHERE wo.organisation_id = ${user.organisationId}
        AND wo.status = 'completed'
        AND wo.assigned_to_id IS NOT NULL
        AND wo.completed_at IS NOT NULL
        ${startDate ? sql`AND wo.completed_at >= ${new Date(startDate)}` : sql``}
        ${endDate ? sql`AND wo.completed_at <= ${new Date(endDate)}` : sql``}
        ${technicianId ? sql`AND wo.assigned_to_id = ${technicianId}` : sql``}
    )
    SELECT
      technician_id,
      count(*) FILTER (WHERE is_rework = true)::int as rework_count
    FROM wo_with_prior
    GROUP BY technician_id
  `)

  // Build a map of technician ID to rework count
  const reworkByTechnician = new Map<string, number>()
  for (const row of reworkQuery) {
    reworkByTechnician.set(row.technician_id, Number.parseInt(row.rework_count, 10))
  }

  // Calculate final technician metrics
  const technicians = technicianMetricsResult.map((row) => {
    const completedCount = row.completedCount
    const reworkCount = reworkByTechnician.get(row.technicianId!) || 0
    const firstTimeFixCount = completedCount - reworkCount
    const firstTimeFixRate = completedCount > 0 ? (firstTimeFixCount / completedCount) * 100 : 0
    const reworkRate = completedCount > 0 ? (reworkCount / completedCount) * 100 : 0
    const avgCompletionHours = Number.parseFloat(String(row.avgCompletionHours)) || 0
    const avgCustomerRating = row.avgCustomerRating
      ? Math.round(Number.parseFloat(String(row.avgCustomerRating)) * 10) / 10
      : null
    const ratedCount = row.ratedCount || 0

    return {
      technicianId: row.technicianId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      completedCount,
      avgCompletionHours: Math.round(avgCompletionHours * 10) / 10,
      // Customer rating (1-5 scale, null if no ratings)
      avgCustomerRating,
      ratedCount,
      firstTimeFixCount,
      reworkCount,
      firstTimeFixRate: Math.round(firstTimeFixRate * 10) / 10,
      reworkRate: Math.round(reworkRate * 10) / 10,
      totalLaborCost: Number.parseFloat(String(row.totalLaborCost)) || 0,
      totalPartsCost: Number.parseFloat(String(row.totalPartsCost)) || 0,
      totalCost: Number.parseFloat(String(row.totalCost)) || 0,
    }
  })

  // Calculate summary statistics
  const totalRatedCount = technicians.reduce((sum, t) => sum + t.ratedCount, 0)
  const totalRatingSum = technicians.reduce(
    (sum, t) => sum + (t.avgCustomerRating || 0) * t.ratedCount,
    0,
  )

  const summary = {
    totalTechnicians: technicians.length,
    totalCompletedWOs: technicians.reduce((sum, t) => sum + t.completedCount, 0),
    avgCompletedPerTechnician:
      technicians.length > 0
        ? Math.round(
            (technicians.reduce((sum, t) => sum + t.completedCount, 0) / technicians.length) * 10,
          ) / 10
        : 0,
    avgCompletionHours:
      technicians.length > 0
        ? Math.round(
            (technicians.reduce((sum, t) => sum + t.avgCompletionHours * t.completedCount, 0) /
              technicians.reduce((sum, t) => sum + t.completedCount, 0)) *
              10,
          ) / 10
        : 0,
    // Overall customer satisfaction rating (1-5 scale, null if no ratings)
    overallCustomerRating:
      totalRatedCount > 0 ? Math.round((totalRatingSum / totalRatedCount) * 10) / 10 : null,
    totalRatedWOs: totalRatedCount,
    overallFirstTimeFixRate:
      technicians.length > 0
        ? Math.round(
            ((technicians.reduce((sum, t) => sum + t.completedCount, 0) -
              technicians.reduce((sum, t) => sum + t.reworkCount, 0)) /
              technicians.reduce((sum, t) => sum + t.completedCount, 0)) *
              100 *
              10,
          ) / 10
        : 0,
    overallReworkRate:
      technicians.length > 0
        ? Math.round(
            (technicians.reduce((sum, t) => sum + t.reworkCount, 0) /
              technicians.reduce((sum, t) => sum + t.completedCount, 0)) *
              100 *
              10,
          ) / 10
        : 0,
    totalCost: technicians.reduce((sum, t) => sum + t.totalCost, 0),
  }

  // Get trend data based on groupBy
  const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM'

  const trendData = await db
    .select({
      period: sql<string>`to_char(${schema.workOrders.completedAt}, ${dateFormat})`,
      completedCount: sql<number>`count(*)::int`,
      avgCompletionHours: sql<number>`
        avg(
          extract(epoch from (${schema.workOrders.completedAt} - ${schema.workOrders.createdAt})) / 3600
        )::numeric
      `,
      avgCustomerRating: sql<number>`avg(${schema.workOrders.customerRating})::numeric`,
      ratedCount: sql<number>`count(${schema.workOrders.customerRating})::int`,
    })
    .from(schema.workOrders)
    .where(whereClause)
    .groupBy(sql`to_char(${schema.workOrders.completedAt}, ${dateFormat})`)
    .orderBy(sql`to_char(${schema.workOrders.completedAt}, ${dateFormat})`)

  const trendDataFormatted = trendData.map((row) => ({
    period: row.period,
    completedCount: row.completedCount,
    avgCompletionHours:
      Math.round((Number.parseFloat(String(row.avgCompletionHours)) || 0) * 10) / 10,
    avgCustomerRating: row.avgCustomerRating
      ? Math.round(Number.parseFloat(String(row.avgCustomerRating)) * 10) / 10
      : null,
    ratedCount: row.ratedCount || 0,
  }))

  // Get top performers (by first-time fix rate, min 5 completed WOs)
  const topPerformers = technicians
    .filter((t) => t.completedCount >= 5)
    .sort((a, b) => b.firstTimeFixRate - a.firstTimeFixRate)
    .slice(0, 5)
    .map((t) => t.technicianId)

  // Get highest rated technicians (by customer rating, min 3 ratings)
  const topRated = technicians
    .filter((t) => t.ratedCount >= 3 && t.avgCustomerRating !== null)
    .sort((a, b) => (b.avgCustomerRating || 0) - (a.avgCustomerRating || 0))
    .slice(0, 5)
    .map((t) => t.technicianId)

  // Get technicians needing attention (lowest first-time fix rate, min 5 completed WOs)
  const needsAttention = technicians
    .filter((t) => t.completedCount >= 5)
    .sort((a, b) => a.firstTimeFixRate - b.firstTimeFixRate)
    .slice(0, 5)
    .map((t) => t.technicianId)

  return {
    technicians,
    summary,
    trendData: trendDataFormatted,
    topPerformers,
    topRated,
    needsAttention,
  }
})
