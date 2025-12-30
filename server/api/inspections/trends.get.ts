import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

interface TrendPoint {
  date: string
  total: number
  passed: number
  failed: number
  defectsReported: number
  defectsResolved: number
}

interface DefectCategoryTrend {
  category: string
  count: number
}

interface SeverityTrend {
  date: string
  critical: number
  major: number
  minor: number
}

export default defineEventHandler(async (event) => {
  // Require reports:read permission for trends
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)

  // Date range (defaults to last 30 days)
  const endDate = query.endDate ? new Date(query.endDate as string) : new Date()
  const startDate = query.startDate
    ? new Date(query.startDate as string)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Granularity: daily, weekly, monthly
  const granularity = (query.granularity as string) || 'daily'

  // Ensure valid dates
  endDate.setHours(23, 59, 59, 999)
  startDate.setHours(0, 0, 0, 0)

  const organisationId = user.organisationId

  // Determine date truncation based on granularity
  const dateTrunc = granularity === 'monthly' ? 'month' : granularity === 'weekly' ? 'week' : 'day'

  // 1. Inspection trends over time
  const inspectionTrends = await db
    .select({
      date: sql<string>`date_trunc(${dateTrunc}, ${schema.inspections.startedAt})::date`.as(
        'trend_date',
      ),
      total: count(),
      passed: sql<number>`count(*) filter (where ${schema.inspections.overallResult} = 'pass')::int`,
      failed: sql<number>`count(*) filter (where ${schema.inspections.overallResult} = 'fail')::int`,
    })
    .from(schema.inspections)
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        eq(schema.inspections.status, 'completed'),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc(${dateTrunc}, ${schema.inspections.startedAt})::date`)
    .orderBy(sql`trend_date`)

  // 2. Defects reported over time
  const defectsReported = await db
    .select({
      date: sql<string>`date_trunc(${dateTrunc}, ${schema.defects.reportedAt})::date`.as(
        'trend_date',
      ),
      count: count(),
    })
    .from(schema.defects)
    .where(
      and(
        eq(schema.defects.organisationId, organisationId),
        gte(schema.defects.reportedAt, startDate),
        lte(schema.defects.reportedAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc(${dateTrunc}, ${schema.defects.reportedAt})::date`)
    .orderBy(sql`trend_date`)

  // 3. Defects resolved over time
  const defectsResolved = await db
    .select({
      date: sql<string>`date_trunc(${dateTrunc}, ${schema.defects.resolvedAt})::date`.as(
        'trend_date',
      ),
      count: count(),
    })
    .from(schema.defects)
    .where(
      and(
        eq(schema.defects.organisationId, organisationId),
        sql`${schema.defects.resolvedAt} is not null`,
        gte(schema.defects.resolvedAt, startDate),
        lte(schema.defects.resolvedAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc(${dateTrunc}, ${schema.defects.resolvedAt})::date`)
    .orderBy(sql`trend_date`)

  // 4. Defect severity trends over time
  const severityTrends = await db
    .select({
      date: sql<string>`date_trunc(${dateTrunc}, ${schema.defects.reportedAt})::date`.as(
        'trend_date',
      ),
      critical: sql<number>`count(*) filter (where ${schema.defects.severity} = 'critical')::int`,
      major: sql<number>`count(*) filter (where ${schema.defects.severity} = 'major')::int`,
      minor: sql<number>`count(*) filter (where ${schema.defects.severity} = 'minor')::int`,
    })
    .from(schema.defects)
    .where(
      and(
        eq(schema.defects.organisationId, organisationId),
        gte(schema.defects.reportedAt, startDate),
        lte(schema.defects.reportedAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc(${dateTrunc}, ${schema.defects.reportedAt})::date`)
    .orderBy(sql`trend_date`)

  // 5. Top defect categories
  const defectCategories = await db
    .select({
      category: sql<string>`COALESCE(${schema.defects.category}, 'Uncategorized')`,
      count: count(),
    })
    .from(schema.defects)
    .where(
      and(
        eq(schema.defects.organisationId, organisationId),
        gte(schema.defects.reportedAt, startDate),
        lte(schema.defects.reportedAt, endDate),
      ),
    )
    .groupBy(sql`COALESCE(${schema.defects.category}, 'Uncategorized')`)
    .orderBy(sql`count(*) desc`)
    .limit(10)

  // 6. Defects by inspection item (common failure points)
  const commonFailures = await db
    .select({
      checklistItemLabel: schema.inspectionItems.checklistItemLabel,
      count: count(),
    })
    .from(schema.defects)
    .innerJoin(
      schema.inspectionItems,
      eq(schema.defects.inspectionItemId, schema.inspectionItems.id),
    )
    .where(
      and(
        eq(schema.defects.organisationId, organisationId),
        gte(schema.defects.reportedAt, startDate),
        lte(schema.defects.reportedAt, endDate),
      ),
    )
    .groupBy(schema.inspectionItems.checklistItemLabel)
    .orderBy(sql`count(*) desc`)
    .limit(10)

  // Create a map of dates to defect counts
  const defectsReportedMap = new Map(defectsReported.map((d) => [d.date, d.count]))
  const defectsResolvedMap = new Map(defectsResolved.map((d) => [d.date, d.count]))

  // Merge inspection trends with defect data
  const combinedTrends: TrendPoint[] = inspectionTrends.map((i) => ({
    date: i.date,
    total: i.total,
    passed: i.passed,
    failed: i.failed,
    defectsReported: defectsReportedMap.get(i.date) || 0,
    defectsResolved: defectsResolvedMap.get(i.date) || 0,
  }))

  // Add dates that have defects but no inspections
  for (const [date, count] of defectsReportedMap) {
    if (!combinedTrends.some((t) => t.date === date)) {
      combinedTrends.push({
        date,
        total: 0,
        passed: 0,
        failed: 0,
        defectsReported: count,
        defectsResolved: defectsResolvedMap.get(date) || 0,
      })
    }
  }

  // Sort by date
  combinedTrends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity,
    },
    inspectionTrends: combinedTrends,
    severityTrends: severityTrends as SeverityTrend[],
    defectCategories: defectCategories as DefectCategoryTrend[],
    commonFailures: commonFailures.map((f) => ({
      checklistItem: f.checklistItemLabel,
      count: f.count,
    })),
  }
})
