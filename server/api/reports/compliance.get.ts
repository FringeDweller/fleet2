/**
 * Compliance Report API (US-14.6)
 *
 * GET /api/reports/compliance
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - assetId: (optional) filter by specific asset
 * - categoryId: (optional) filter by asset category
 *
 * Returns:
 * - preStartCompletionRate: percentage of required pre-start inspections completed
 * - maintenanceCompliance: percentage of scheduled maintenance done on time
 * - certificationStatus: count of valid, expiring (within 30 days), expired certs
 * - overdueItems: list of overdue maintenance and expired certifications
 */

import { and, count, eq, gte, isNotNull, isNull, lt, lte, or, type SQL, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

interface OverdueMaintenanceItem {
  id: string
  name: string
  assetId: string
  assetNumber: string
  assetMake: string | null
  assetModel: string | null
  nextDueDate: Date | null
  daysOverdue: number
  scheduleType: string
}

interface ExpiredCertificationItem {
  id: string
  documentName: string
  assetId: string | null
  assetNumber: string | null
  assetMake: string | null
  assetModel: string | null
  expiryDate: Date | null
  daysExpired: number
  category: string
}

interface MaintenanceComplianceMetrics {
  totalScheduled: number
  completedOnTime: number
  completedLate: number
  overdue: number
  complianceRate: number
}

interface CertificationStatusMetrics {
  valid: number
  expiringSoon: number // within 30 days
  expired: number
}

interface PreStartComplianceMetrics {
  totalRequired: number
  totalCompleted: number
  completionRate: number
  assetsWithInspections: number
  assetsWithoutInspections: number
}

interface ComplianceReportResponse {
  preStartCompliance: PreStartComplianceMetrics
  maintenanceCompliance: MaintenanceComplianceMetrics
  certificationStatus: CertificationStatusMetrics
  overdueItems: {
    maintenance: OverdueMaintenanceItem[]
    certifications: ExpiredCertificationItem[]
  }
  summary: {
    overallComplianceScore: number
    totalOverdueItems: number
    criticalItems: number
  }
}

export default defineEventHandler(async (event): Promise<ComplianceReportResponse> => {
  // Require reports:read permission
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const assetId = query.assetId as string | undefined
  const categoryId = query.categoryId as string | undefined

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Default date range: last 30 days if not specified
  const effectiveStartDate = startDate
    ? new Date(startDate)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const effectiveEndDate = endDate ? new Date(endDate) : now

  // Build asset filter conditions
  const assetConditions: SQL[] = [
    eq(schema.assets.organisationId, user.organisationId),
    eq(schema.assets.isArchived, false),
  ]

  if (assetId) {
    assetConditions.push(eq(schema.assets.id, assetId))
  }

  if (categoryId) {
    assetConditions.push(eq(schema.assets.categoryId, categoryId))
  }

  // Get all assets matching filters
  const assets = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      make: schema.assets.make,
      model: schema.assets.model,
      categoryId: schema.assets.categoryId,
    })
    .from(schema.assets)
    .where(and(...assetConditions))

  const assetIds = assets.map((a) => a.id)
  const assetMap = new Map(assets.map((a) => [a.id, a]))

  // 1. Pre-Start Inspection Compliance
  let preStartCompliance: PreStartComplianceMetrics = {
    totalRequired: 0,
    totalCompleted: 0,
    completionRate: 0,
    assetsWithInspections: 0,
    assetsWithoutInspections: 0,
  }

  if (assetIds.length > 0) {
    // Get count of completed inspections in date range for these assets
    const inspectionResults = await db
      .select({
        assetId: schema.inspections.assetId,
        count: count(),
      })
      .from(schema.inspections)
      .where(
        and(
          eq(schema.inspections.organisationId, user.organisationId),
          eq(schema.inspections.status, 'completed'),
          gte(schema.inspections.completedAt, effectiveStartDate),
          lte(schema.inspections.completedAt, effectiveEndDate),
          sql`${schema.inspections.assetId} = ANY(${assetIds})`,
        ),
      )
      .groupBy(schema.inspections.assetId)

    const assetsWithInspections = new Set(inspectionResults.map((r) => r.assetId))
    const totalCompleted = inspectionResults.reduce((sum, r) => sum + r.count, 0)

    // Calculate required inspections (assuming one per active asset per day in range)
    const dayCount = Math.ceil(
      (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    const totalRequired = assets.length * dayCount

    preStartCompliance = {
      totalRequired,
      totalCompleted,
      completionRate:
        totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100 * 10) / 10 : 0,
      assetsWithInspections: assetsWithInspections.size,
      assetsWithoutInspections: assets.length - assetsWithInspections.size,
    }
  }

  // 2. Maintenance Schedule Compliance
  const maintenanceConditions: SQL[] = [
    eq(schema.maintenanceSchedules.organisationId, user.organisationId),
    eq(schema.maintenanceSchedules.isActive, true),
    eq(schema.maintenanceSchedules.isArchived, false),
  ]

  // Filter by asset or category
  if (assetId) {
    maintenanceConditions.push(eq(schema.maintenanceSchedules.assetId, assetId))
  } else if (categoryId) {
    maintenanceConditions.push(
      or(
        eq(schema.maintenanceSchedules.categoryId, categoryId),
        sql`${schema.maintenanceSchedules.assetId} = ANY(${assetIds})`,
      )!,
    )
  }

  // Get maintenance schedules with their next due dates
  const maintenanceSchedules = await db
    .select({
      id: schema.maintenanceSchedules.id,
      name: schema.maintenanceSchedules.name,
      assetId: schema.maintenanceSchedules.assetId,
      categoryId: schema.maintenanceSchedules.categoryId,
      nextDueDate: schema.maintenanceSchedules.nextDueDate,
      lastGeneratedAt: schema.maintenanceSchedules.lastGeneratedAt,
      scheduleType: schema.maintenanceSchedules.scheduleType,
    })
    .from(schema.maintenanceSchedules)
    .where(and(...maintenanceConditions))

  // Count overdue, on-time, and late completed
  let overdueCount = 0
  let completedOnTime = 0
  let completedLate = 0
  const overdueMaintenanceItems: OverdueMaintenanceItem[] = []

  for (const schedule of maintenanceSchedules) {
    if (schedule.nextDueDate) {
      if (schedule.nextDueDate < now) {
        // Overdue
        overdueCount++
        const daysOverdue = Math.ceil(
          (now.getTime() - schedule.nextDueDate.getTime()) / (24 * 60 * 60 * 1000),
        )

        // Get asset info
        let assetInfo = schedule.assetId ? assetMap.get(schedule.assetId) : null

        // If schedule is for a category, find one of the affected assets
        if (!assetInfo && schedule.categoryId) {
          assetInfo = assets.find((a) => a.categoryId === schedule.categoryId)
        }

        if (assetInfo) {
          overdueMaintenanceItems.push({
            id: schedule.id,
            name: schedule.name,
            assetId: assetInfo.id,
            assetNumber: assetInfo.assetNumber,
            assetMake: assetInfo.make,
            assetModel: assetInfo.model,
            nextDueDate: schedule.nextDueDate,
            daysOverdue,
            scheduleType: schedule.scheduleType,
          })
        }
      } else if (schedule.lastGeneratedAt && schedule.lastGeneratedAt <= schedule.nextDueDate) {
        completedOnTime++
      }
    }
  }

  // Check completed work orders from schedules in date range
  const workOrdersFromSchedules = await db
    .select({
      scheduleId: schema.maintenanceScheduleWorkOrders.scheduleId,
      scheduledDate: schema.maintenanceScheduleWorkOrders.scheduledDate,
      completedAt: schema.workOrders.completedAt,
    })
    .from(schema.maintenanceScheduleWorkOrders)
    .innerJoin(
      schema.workOrders,
      eq(schema.maintenanceScheduleWorkOrders.workOrderId, schema.workOrders.id),
    )
    .where(
      and(
        eq(schema.workOrders.organisationId, user.organisationId),
        eq(schema.workOrders.status, 'completed'),
        gte(schema.workOrders.completedAt, effectiveStartDate),
        lte(schema.workOrders.completedAt, effectiveEndDate),
      ),
    )

  for (const wo of workOrdersFromSchedules) {
    if (wo.completedAt && wo.scheduledDate) {
      if (wo.completedAt <= wo.scheduledDate) {
        completedOnTime++
      } else {
        completedLate++
      }
    }
  }

  const totalScheduled = maintenanceSchedules.length
  const maintenanceComplianceRate =
    totalScheduled > 0
      ? Math.round(
          (completedOnTime / (completedOnTime + completedLate + overdueCount)) * 100 * 10,
        ) / 10
      : 100

  const maintenanceCompliance: MaintenanceComplianceMetrics = {
    totalScheduled,
    completedOnTime,
    completedLate,
    overdue: overdueCount,
    complianceRate: Number.isNaN(maintenanceComplianceRate) ? 100 : maintenanceComplianceRate,
  }

  // 3. Certification Status (from documents with category = certification and expiry dates)
  const certConditions: SQL[] = [
    eq(schema.documents.organisationId, user.organisationId),
    eq(schema.documents.category, 'certification'),
    isNotNull(schema.documents.expiryDate),
  ]

  // Get all certifications
  const certifications = await db
    .select({
      id: schema.documents.id,
      name: schema.documents.name,
      expiryDate: schema.documents.expiryDate,
      category: schema.documents.category,
    })
    .from(schema.documents)
    .where(and(...certConditions))

  // Also check document links to assets
  const certWithAssets = await db
    .select({
      documentId: schema.documentLinks.documentId,
      assetId: schema.documentLinks.entityId,
      documentName: schema.documents.name,
      expiryDate: schema.documents.expiryDate,
      category: schema.documents.category,
    })
    .from(schema.documentLinks)
    .innerJoin(schema.documents, eq(schema.documentLinks.documentId, schema.documents.id))
    .where(
      and(
        eq(schema.documentLinks.entityType, 'asset'),
        eq(schema.documents.category, 'certification'),
        isNotNull(schema.documents.expiryDate),
        eq(schema.documents.organisationId, user.organisationId),
        assetIds.length > 0 ? sql`${schema.documentLinks.entityId} = ANY(${assetIds})` : undefined,
      ),
    )

  let validCount = 0
  let expiringSoonCount = 0
  let expiredCount = 0
  const expiredCertifications: ExpiredCertificationItem[] = []

  // Process linked certifications
  for (const cert of certWithAssets) {
    if (!cert.expiryDate) continue

    const assetInfo = cert.assetId ? assetMap.get(cert.assetId) : null

    if (cert.expiryDate < now) {
      expiredCount++
      const daysExpired = Math.ceil(
        (now.getTime() - cert.expiryDate.getTime()) / (24 * 60 * 60 * 1000),
      )
      expiredCertifications.push({
        id: cert.documentId,
        documentName: cert.documentName,
        assetId: cert.assetId,
        assetNumber: assetInfo?.assetNumber || null,
        assetMake: assetInfo?.make || null,
        assetModel: assetInfo?.model || null,
        expiryDate: cert.expiryDate,
        daysExpired,
        category: cert.category,
      })
    } else if (cert.expiryDate <= thirtyDaysFromNow) {
      expiringSoonCount++
    } else {
      validCount++
    }
  }

  // Also count certifications without asset links
  const linkedDocIds = new Set(certWithAssets.map((c) => c.documentId))
  for (const cert of certifications) {
    if (linkedDocIds.has(cert.id)) continue
    if (!cert.expiryDate) continue

    if (cert.expiryDate < now) {
      expiredCount++
      const daysExpired = Math.ceil(
        (now.getTime() - cert.expiryDate.getTime()) / (24 * 60 * 60 * 1000),
      )
      expiredCertifications.push({
        id: cert.id,
        documentName: cert.name,
        assetId: null,
        assetNumber: null,
        assetMake: null,
        assetModel: null,
        expiryDate: cert.expiryDate,
        daysExpired,
        category: cert.category,
      })
    } else if (cert.expiryDate <= thirtyDaysFromNow) {
      expiringSoonCount++
    } else {
      validCount++
    }
  }

  const certificationStatus: CertificationStatusMetrics = {
    valid: validCount,
    expiringSoon: expiringSoonCount,
    expired: expiredCount,
  }

  // Calculate overall compliance score (weighted average)
  // Pre-start: 40%, Maintenance: 40%, Certifications: 20%
  const certComplianceRate =
    validCount + expiringSoonCount + expiredCount > 0
      ? (validCount / (validCount + expiringSoonCount + expiredCount)) * 100
      : 100

  const overallComplianceScore =
    Math.round(
      (preStartCompliance.completionRate * 0.4 +
        maintenanceCompliance.complianceRate * 0.4 +
        certComplianceRate * 0.2) *
        10,
    ) / 10

  // Sort overdue items by severity (most overdue first)
  overdueMaintenanceItems.sort((a, b) => b.daysOverdue - a.daysOverdue)
  expiredCertifications.sort((a, b) => b.daysExpired - a.daysExpired)

  // Critical items are those more than 7 days overdue/expired
  const criticalItems =
    overdueMaintenanceItems.filter((i) => i.daysOverdue > 7).length +
    expiredCertifications.filter((i) => i.daysExpired > 7).length

  return {
    preStartCompliance,
    maintenanceCompliance,
    certificationStatus,
    overdueItems: {
      maintenance: overdueMaintenanceItems.slice(0, 20), // Limit to top 20
      certifications: expiredCertifications.slice(0, 20),
    },
    summary: {
      overallComplianceScore,
      totalOverdueItems: overdueMaintenanceItems.length + expiredCertifications.length,
      criticalItems,
    },
  }
})
