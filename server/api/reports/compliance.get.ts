/**
 * Compliance Report API (US-14.6)
 *
 * GET /api/reports/compliance
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - vehicleId: (optional) filter by specific vehicle/asset (alias for assetId)
 * - assetId: (optional) filter by specific asset
 * - categoryId: (optional) filter by asset category
 *
 * Returns:
 * - inspectionStatus: per-vehicle inspection completion metrics
 * - registrationStatus: per-vehicle registration expiry status
 * - insuranceStatus: per-vehicle insurance status
 * - preStartCompliance: aggregate pre-start inspection metrics
 * - maintenanceCompliance: percentage of scheduled maintenance done on time
 * - certificationStatus: count of valid, expiring (within 30 days), expired certs
 * - overdueItems: list of overdue maintenance and expired documents
 * - vehicleCompliance: per-vehicle compliance breakdown
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

interface ExpiredDocumentItem {
  id: string
  documentName: string
  documentType: string
  assetId: string | null
  assetNumber: string | null
  assetMake: string | null
  assetModel: string | null
  expiryDate: Date | null
  daysExpired: number
  category: string
}

// Legacy alias for backward compatibility
type ExpiredCertificationItem = ExpiredDocumentItem

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

interface VehicleInspectionStatus {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  lastInspectionDate: Date | null
  inspectionCount: number
  hasRecentInspection: boolean // within date range
}

interface VehicleDocumentStatus {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  expiryDate: Date | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  daysUntilExpiry: number | null
  documentName: string | null
}

interface VehicleComplianceRecord {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  inspectionStatus: 'compliant' | 'non_compliant' | 'pending'
  registrationStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  insuranceStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  registrationExpiry: Date | null
  insuranceExpiry: Date | null
  lastInspectionDate: Date | null
  overallStatus: 'compliant' | 'at_risk' | 'non_compliant'
}

interface ComplianceReportResponse {
  // Per-vehicle compliance (new)
  vehicleCompliance: VehicleComplianceRecord[]

  // Aggregate metrics
  inspectionStatus: {
    totalVehicles: number
    vehiclesInspected: number
    vehiclesNotInspected: number
    complianceRate: number
  }
  registrationStatus: {
    valid: number
    expiringSoon: number
    expired: number
    missing: number
  }
  insuranceStatus: {
    valid: number
    expiringSoon: number
    expired: number
    missing: number
  }

  // Legacy fields for backward compatibility
  preStartCompliance: PreStartComplianceMetrics
  maintenanceCompliance: MaintenanceComplianceMetrics
  certificationStatus: CertificationStatusMetrics
  overdueItems: {
    maintenance: OverdueMaintenanceItem[]
    certifications: ExpiredDocumentItem[]
    registrations: ExpiredDocumentItem[]
    insurance: ExpiredDocumentItem[]
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
  // Support both vehicleId (as per requirement) and assetId (legacy)
  const assetId = (query.vehicleId as string | undefined) || (query.assetId as string | undefined)
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
  const expiredCertifications: ExpiredDocumentItem[] = []

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
        documentType: 'certification',
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
        documentType: 'certification',
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

  // 4. Registration Status (from asset_documents with documentType = 'registration')
  const registrationDocs = await db
    .select({
      id: schema.assetDocuments.id,
      assetId: schema.assetDocuments.assetId,
      name: schema.assetDocuments.name,
      expiryDate: schema.assetDocuments.expiryDate,
      documentType: schema.assetDocuments.documentType,
    })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assetDocuments.documentType, 'registration'),
        assetIds.length > 0 ? sql`${schema.assetDocuments.assetId} = ANY(${assetIds})` : undefined,
      ),
    )

  const registrationByAsset = new Map<string, (typeof registrationDocs)[0]>()
  for (const doc of registrationDocs) {
    const existing = registrationByAsset.get(doc.assetId)
    // Keep the most recent expiry date if multiple registrations exist
    if (
      !existing ||
      (doc.expiryDate && (!existing.expiryDate || doc.expiryDate > existing.expiryDate))
    ) {
      registrationByAsset.set(doc.assetId, doc)
    }
  }

  let regValidCount = 0
  let regExpiringSoonCount = 0
  let regExpiredCount = 0
  let regMissingCount = 0
  const expiredRegistrations: ExpiredDocumentItem[] = []

  for (const asset of assets) {
    const regDoc = registrationByAsset.get(asset.id)
    if (!regDoc || !regDoc.expiryDate) {
      regMissingCount++
    } else if (regDoc.expiryDate < now) {
      regExpiredCount++
      const daysExpired = Math.ceil(
        (now.getTime() - regDoc.expiryDate.getTime()) / (24 * 60 * 60 * 1000),
      )
      expiredRegistrations.push({
        id: regDoc.id,
        documentName: regDoc.name,
        documentType: 'registration',
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        assetMake: asset.make,
        assetModel: asset.model,
        expiryDate: regDoc.expiryDate,
        daysExpired,
        category: 'registration',
      })
    } else if (regDoc.expiryDate <= thirtyDaysFromNow) {
      regExpiringSoonCount++
    } else {
      regValidCount++
    }
  }

  const registrationStatus = {
    valid: regValidCount,
    expiringSoon: regExpiringSoonCount,
    expired: regExpiredCount,
    missing: regMissingCount,
  }

  // 5. Insurance Status (from asset_documents with documentType = 'insurance')
  const insuranceDocs = await db
    .select({
      id: schema.assetDocuments.id,
      assetId: schema.assetDocuments.assetId,
      name: schema.assetDocuments.name,
      expiryDate: schema.assetDocuments.expiryDate,
      documentType: schema.assetDocuments.documentType,
    })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assetDocuments.documentType, 'insurance'),
        assetIds.length > 0 ? sql`${schema.assetDocuments.assetId} = ANY(${assetIds})` : undefined,
      ),
    )

  const insuranceByAsset = new Map<string, (typeof insuranceDocs)[0]>()
  for (const doc of insuranceDocs) {
    const existing = insuranceByAsset.get(doc.assetId)
    // Keep the most recent expiry date if multiple insurance docs exist
    if (
      !existing ||
      (doc.expiryDate && (!existing.expiryDate || doc.expiryDate > existing.expiryDate))
    ) {
      insuranceByAsset.set(doc.assetId, doc)
    }
  }

  let insValidCount = 0
  let insExpiringSoonCount = 0
  let insExpiredCount = 0
  let insMissingCount = 0
  const expiredInsurance: ExpiredDocumentItem[] = []

  for (const asset of assets) {
    const insDoc = insuranceByAsset.get(asset.id)
    if (!insDoc || !insDoc.expiryDate) {
      insMissingCount++
    } else if (insDoc.expiryDate < now) {
      insExpiredCount++
      const daysExpired = Math.ceil(
        (now.getTime() - insDoc.expiryDate.getTime()) / (24 * 60 * 60 * 1000),
      )
      expiredInsurance.push({
        id: insDoc.id,
        documentName: insDoc.name,
        documentType: 'insurance',
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        assetMake: asset.make,
        assetModel: asset.model,
        expiryDate: insDoc.expiryDate,
        daysExpired,
        category: 'insurance',
      })
    } else if (insDoc.expiryDate <= thirtyDaysFromNow) {
      insExpiringSoonCount++
    } else {
      insValidCount++
    }
  }

  const insuranceStatus = {
    valid: insValidCount,
    expiringSoon: insExpiringSoonCount,
    expired: insExpiredCount,
    missing: insMissingCount,
  }

  // 6. Build per-vehicle compliance records
  // Get last inspection date for each asset
  const lastInspectionByAsset = new Map<string, Date | null>()
  if (assetIds.length > 0) {
    const lastInspections = await db
      .select({
        assetId: schema.inspections.assetId,
        lastDate: sql<Date>`MAX(${schema.inspections.completedAt})`,
      })
      .from(schema.inspections)
      .where(
        and(
          eq(schema.inspections.organisationId, user.organisationId),
          eq(schema.inspections.status, 'completed'),
          sql`${schema.inspections.assetId} = ANY(${assetIds})`,
        ),
      )
      .groupBy(schema.inspections.assetId)

    for (const insp of lastInspections) {
      lastInspectionByAsset.set(insp.assetId, insp.lastDate)
    }
  }

  const vehicleCompliance: VehicleComplianceRecord[] = assets.map((asset) => {
    const regDoc = registrationByAsset.get(asset.id)
    const insDoc = insuranceByAsset.get(asset.id)
    const lastInspection = lastInspectionByAsset.get(asset.id)
    const hasRecentInspection = lastInspection && lastInspection >= effectiveStartDate

    // Determine registration status
    let regStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing'
    if (regDoc?.expiryDate) {
      if (regDoc.expiryDate < now) regStatus = 'expired'
      else if (regDoc.expiryDate <= thirtyDaysFromNow) regStatus = 'expiring_soon'
      else regStatus = 'valid'
    }

    // Determine insurance status
    let insStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing'
    if (insDoc?.expiryDate) {
      if (insDoc.expiryDate < now) insStatus = 'expired'
      else if (insDoc.expiryDate <= thirtyDaysFromNow) insStatus = 'expiring_soon'
      else insStatus = 'valid'
    }

    // Determine inspection status
    let inspStatus: 'compliant' | 'non_compliant' | 'pending' = 'pending'
    if (hasRecentInspection) {
      inspStatus = 'compliant'
    } else if (lastInspection) {
      inspStatus = 'non_compliant'
    }

    // Determine overall status
    let overallStatus: 'compliant' | 'at_risk' | 'non_compliant' = 'compliant'
    if (
      regStatus === 'expired' ||
      insStatus === 'expired' ||
      regStatus === 'missing' ||
      insStatus === 'missing'
    ) {
      overallStatus = 'non_compliant'
    } else if (
      regStatus === 'expiring_soon' ||
      insStatus === 'expiring_soon' ||
      inspStatus === 'non_compliant'
    ) {
      overallStatus = 'at_risk'
    }

    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
      inspectionStatus: inspStatus,
      registrationStatus: regStatus,
      insuranceStatus: insStatus,
      registrationExpiry: regDoc?.expiryDate || null,
      insuranceExpiry: insDoc?.expiryDate || null,
      lastInspectionDate: lastInspection || null,
      overallStatus,
    }
  })

  // Aggregate inspection status
  const inspectionStatusAgg = {
    totalVehicles: assets.length,
    vehiclesInspected: preStartCompliance.assetsWithInspections,
    vehiclesNotInspected: preStartCompliance.assetsWithoutInspections,
    complianceRate: preStartCompliance.completionRate,
  }

  // Calculate overall compliance score (weighted average)
  // Pre-start: 25%, Maintenance: 25%, Registration: 25%, Insurance: 25%
  const regComplianceRate =
    assets.length > 0 ? ((regValidCount + regExpiringSoonCount) / assets.length) * 100 : 100
  const insComplianceRate =
    assets.length > 0 ? ((insValidCount + insExpiringSoonCount) / assets.length) * 100 : 100
  const certComplianceRate =
    validCount + expiringSoonCount + expiredCount > 0
      ? (validCount / (validCount + expiringSoonCount + expiredCount)) * 100
      : 100

  const overallComplianceScore =
    Math.round(
      (preStartCompliance.completionRate * 0.25 +
        maintenanceCompliance.complianceRate * 0.25 +
        regComplianceRate * 0.25 +
        insComplianceRate * 0.25) *
        10,
    ) / 10

  // Sort overdue items by severity (most overdue first)
  overdueMaintenanceItems.sort((a, b) => b.daysOverdue - a.daysOverdue)
  expiredCertifications.sort((a, b) => b.daysExpired - a.daysExpired)
  expiredRegistrations.sort((a, b) => b.daysExpired - a.daysExpired)
  expiredInsurance.sort((a, b) => b.daysExpired - a.daysExpired)

  // Critical items are those more than 7 days overdue/expired
  const criticalItems =
    overdueMaintenanceItems.filter((i) => i.daysOverdue > 7).length +
    expiredCertifications.filter((i) => i.daysExpired > 7).length +
    expiredRegistrations.filter((i) => i.daysExpired > 7).length +
    expiredInsurance.filter((i) => i.daysExpired > 7).length

  const totalOverdueItems =
    overdueMaintenanceItems.length +
    expiredCertifications.length +
    expiredRegistrations.length +
    expiredInsurance.length

  return {
    // Per-vehicle compliance
    vehicleCompliance,

    // Aggregate metrics
    inspectionStatus: inspectionStatusAgg,
    registrationStatus,
    insuranceStatus,

    // Legacy fields for backward compatibility
    preStartCompliance,
    maintenanceCompliance,
    certificationStatus,
    overdueItems: {
      maintenance: overdueMaintenanceItems.slice(0, 20), // Limit to top 20
      certifications: expiredCertifications.slice(0, 20),
      registrations: expiredRegistrations.slice(0, 20),
      insurance: expiredInsurance.slice(0, 20),
    },
    summary: {
      overallComplianceScore,
      totalOverdueItems,
      criticalItems,
    },
  }
})
