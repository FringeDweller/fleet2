import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require reports:read permission for compliance stats
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)

  // Date range for compliance calculations (defaults to last 30 days)
  const endDate = query.endDate ? new Date(query.endDate as string) : new Date()
  const startDate = query.startDate
    ? new Date(query.startDate as string)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Ensure valid dates
  endDate.setHours(23, 59, 59, 999)
  startDate.setHours(0, 0, 0, 0)

  const organisationId = user.organisationId

  // 1. Total active assets
  const [assetsResult] = await db
    .select({ count: count() })
    .from(schema.assets)
    .where(
      and(eq(schema.assets.organisationId, organisationId), eq(schema.assets.isArchived, false)),
    )
  const totalAssets = assetsResult?.count || 0

  // 2. Assets with at least one completed inspection in the date range
  const [assetsInspectedResult] = await db
    .select({
      count: sql<number>`count(DISTINCT ${schema.inspections.assetId})::int`,
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
  const assetsInspected = assetsInspectedResult?.count || 0

  // 3. Total inspections in date range
  const [totalInspectionsResult] = await db
    .select({ count: count() })
    .from(schema.inspections)
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
  const totalInspections = totalInspectionsResult?.count || 0

  // 4. Completed inspections in date range
  const [completedInspectionsResult] = await db
    .select({ count: count() })
    .from(schema.inspections)
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        eq(schema.inspections.status, 'completed'),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
  const completedInspections = completedInspectionsResult?.count || 0

  // 5. Inspections by result (pass/fail)
  const resultStats = await db
    .select({
      overallResult: schema.inspections.overallResult,
      count: count(),
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
    .groupBy(schema.inspections.overallResult)

  const passCount = resultStats.find((r) => r.overallResult === 'pass')?.count || 0
  const failCount = resultStats.find((r) => r.overallResult === 'fail')?.count || 0

  // 6. Open defects count
  const [openDefectsResult] = await db
    .select({ count: count() })
    .from(schema.defects)
    .where(
      and(eq(schema.defects.organisationId, organisationId), eq(schema.defects.status, 'open')),
    )
  const openDefects = openDefectsResult?.count || 0

  // 7. Defects by severity
  const defectsBySeverity = await db
    .select({
      severity: schema.defects.severity,
      count: count(),
    })
    .from(schema.defects)
    .where(
      and(eq(schema.defects.organisationId, organisationId), eq(schema.defects.status, 'open')),
    )
    .groupBy(schema.defects.severity)

  const criticalDefects = defectsBySeverity.find((d) => d.severity === 'critical')?.count || 0
  const majorDefects = defectsBySeverity.find((d) => d.severity === 'major')?.count || 0
  const minorDefects = defectsBySeverity.find((d) => d.severity === 'minor')?.count || 0

  // 8. Inspection completion rate
  const completionRate = totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0

  // 9. Fleet compliance rate (assets with at least one completed inspection)
  const fleetComplianceRate = totalAssets > 0 ? (assetsInspected / totalAssets) * 100 : 0

  // 10. Pass rate for completed inspections
  const passRate = completedInspections > 0 ? (passCount / completedInspections) * 100 : 0

  // 11. Inspections by status
  const inspectionsByStatus = await db
    .select({
      status: schema.inspections.status,
      count: count(),
    })
    .from(schema.inspections)
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
    .groupBy(schema.inspections.status)

  // 12. Top inspection templates used
  const topTemplates = await db
    .select({
      templateId: schema.inspections.templateId,
      templateName: schema.inspectionTemplates.name,
      count: count(),
    })
    .from(schema.inspections)
    .innerJoin(
      schema.inspectionTemplates,
      eq(schema.inspections.templateId, schema.inspectionTemplates.id),
    )
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
    .groupBy(schema.inspections.templateId, schema.inspectionTemplates.name)
    .orderBy(sql`count(*) desc`)
    .limit(5)

  // 13. Assets with most failures
  const assetsWithFailures = await db
    .select({
      assetId: schema.inspections.assetId,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
      failedCount: count(),
    })
    .from(schema.inspections)
    .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.inspections.organisationId, organisationId),
        eq(schema.inspections.status, 'completed'),
        eq(schema.inspections.overallResult, 'fail'),
        gte(schema.inspections.startedAt, startDate),
        lte(schema.inspections.startedAt, endDate),
      ),
    )
    .groupBy(
      schema.inspections.assetId,
      schema.assets.assetNumber,
      schema.assets.make,
      schema.assets.model,
    )
    .orderBy(sql`count(*) desc`)
    .limit(5)

  return {
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    summary: {
      totalAssets,
      assetsInspected,
      totalInspections,
      completedInspections,
      passCount,
      failCount,
      openDefects,
      criticalDefects,
      majorDefects,
      minorDefects,
    },
    rates: {
      completionRate: Math.round(completionRate * 10) / 10,
      fleetComplianceRate: Math.round(fleetComplianceRate * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
    },
    byStatus: inspectionsByStatus.map((s) => ({
      status: s.status,
      count: s.count,
    })),
    topTemplates: topTemplates.map((t) => ({
      templateId: t.templateId,
      templateName: t.templateName,
      count: t.count,
    })),
    assetsWithMostFailures: assetsWithFailures.map((a) => ({
      assetId: a.assetId,
      assetNumber: a.assetNumber,
      make: a.make,
      model: a.model,
      failedCount: a.failedCount,
    })),
  }
})
