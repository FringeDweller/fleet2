/**
 * US-9.5: Defect Escalation Utility
 * Handles creation of defects from failed inspection items with automatic work order creation
 */
import { eq, sql } from 'drizzle-orm'
import type { NewDefect } from '../db/schema/defects'
import { db, schema } from './db'
import { createNotification } from './notifications'

interface DefectEscalationInput {
  organisationId: string
  assetId: string
  inspectionId?: string
  inspectionItemId?: string
  reportedById: string
  title: string
  description?: string
  category?: string
  severity: 'minor' | 'major' | 'critical'
  location?: string
  photos?: string
  /** Override org setting to force work order creation */
  forceCreateWorkOrder?: boolean
  /** Override org setting to prevent work order creation */
  skipWorkOrder?: boolean
}

interface DefectEscalationResult {
  defect: {
    id: string
    title: string
    severity: string
    status: string
  }
  workOrder: {
    id: string
    workOrderNumber: string
    priority: string
    status: string
  } | null
  supervisorsNotified: number
}

/**
 * Map defect severity to work order priority
 */
function severityToPriority(
  severity: 'minor' | 'major' | 'critical',
): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'major':
      return 'high'
    default:
      return 'medium'
  }
}

/**
 * Generate work order number for the organisation
 */
async function generateWorkOrderNumber(organisationId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.workOrders)
    .where(eq(schema.workOrders.organisationId, organisationId))

  const count = result[0]?.count ?? 0
  const nextNumber = count + 1
  return `WO-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Get supervisors for an organisation (users with supervisor role or specific permission)
 */
async function getSupervisors(
  organisationId: string,
): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
  // Get all users in the org who have roles with supervisor/admin permissions
  const supervisors = await db.query.users.findMany({
    where: eq(schema.users.organisationId, organisationId),
    with: {
      role: true,
    },
  })

  // Filter for users with supervisor-level roles or admin permissions
  return supervisors
    .filter((user) => {
      if (!user.role) return false
      const permissions = user.role.permissions as string[] | null
      if (!permissions) return false
      // Consider anyone with work_orders:write, admin, or supervisor permissions
      return (
        permissions.includes('*') ||
        permissions.includes('admin') ||
        permissions.includes('supervisor') ||
        permissions.includes('work_orders:write')
      )
    })
    .map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    }))
}

/**
 * Create a defect with optional automatic work order creation and supervisor notification
 */
export async function createDefectWithEscalation(
  input: DefectEscalationInput,
): Promise<DefectEscalationResult> {
  // Get organisation settings
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, input.organisationId),
  })

  if (!organisation) {
    throw new Error('Organisation not found')
  }

  // Get asset info for work order title
  const asset = await db.query.assets.findFirst({
    where: eq(schema.assets.id, input.assetId),
    columns: {
      id: true,
      assetNumber: true,
      make: true,
      model: true,
    },
  })

  // Get reporter info
  const reporter = await db.query.users.findFirst({
    where: eq(schema.users.id, input.reportedById),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
    },
  })

  const now = new Date()

  // Determine if work order should be created:
  // - Major and critical defects create work orders by default (if org setting enabled)
  // - Minor defects don't create work orders unless forced
  const shouldCreateWorkOrder =
    !input.skipWorkOrder &&
    (input.forceCreateWorkOrder ||
      (organisation.autoCreateWorkOrderOnDefect &&
        (input.severity === 'major' || input.severity === 'critical')))

  // Use a transaction to ensure consistency
  const { defect: result, workOrder: workOrderResult } = await db.transaction(async (tx) => {
    let createdWorkOrderId: string | null = null
    let createdWorkOrder: DefectEscalationResult['workOrder'] = null

    // Create work order first if needed (so we can link defect to it)
    if (shouldCreateWorkOrder) {
      const workOrderNumber = await generateWorkOrderNumber(input.organisationId)
      const priority = severityToPriority(input.severity)
      const assetLabel = asset
        ? `${asset.assetNumber}${asset.make ? ` - ${asset.make}` : ''}${asset.model ? ` ${asset.model}` : ''}`
        : 'Unknown Asset'

      const [newWorkOrder] = await tx
        .insert(schema.workOrders)
        .values({
          organisationId: input.organisationId,
          workOrderNumber,
          assetId: input.assetId,
          createdById: input.reportedById,
          title: `Defect: ${input.title}`,
          description: `Auto-generated from defect report on ${assetLabel}.\n\n${input.description || ''}${input.location ? `\n\nLocation on asset: ${input.location}` : ''}`,
          priority,
          status: 'open',
          // Set due date based on severity - critical same day, major 3 days, otherwise 7 days
          dueDate:
            priority === 'critical'
              ? now
              : priority === 'high'
                ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
                : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning()

      if (newWorkOrder) {
        createdWorkOrderId = newWorkOrder.id

        // Create initial status history
        await tx.insert(schema.workOrderStatusHistory).values({
          workOrderId: newWorkOrder.id,
          fromStatus: null,
          toStatus: 'open',
          changedById: input.reportedById,
          notes: 'Auto-created from defect report',
        })

        createdWorkOrder = {
          id: newWorkOrder.id,
          workOrderNumber: newWorkOrder.workOrderNumber,
          priority: newWorkOrder.priority,
          status: newWorkOrder.status,
        }
      }
    }

    // Create the defect record
    const defectValues: NewDefect = {
      organisationId: input.organisationId,
      assetId: input.assetId,
      inspectionId: input.inspectionId,
      inspectionItemId: input.inspectionItemId,
      workOrderId: createdWorkOrderId,
      reportedById: input.reportedById,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      status: 'open',
      location: input.location,
      photos: input.photos,
      reportedAt: now,
      updatedAt: now,
    }

    const [newDefect] = await tx.insert(schema.defects).values(defectValues).returning()

    if (!newDefect) {
      throw new Error('Failed to create defect')
    }

    // Create audit log entry
    await tx.insert(schema.auditLog).values({
      organisationId: input.organisationId,
      userId: input.reportedById,
      action: 'create',
      entityType: 'defect',
      entityId: newDefect.id,
      newValues: {
        ...newDefect,
        workOrderCreated: !!createdWorkOrderId,
      },
    })

    return { defect: newDefect, workOrder: createdWorkOrder }
  })

  // Notify supervisors (outside transaction for performance)
  const supervisors = await getSupervisors(input.organisationId)
  let supervisorsNotified = 0

  const reporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Unknown user'
  const assetLabel = asset?.assetNumber || 'Unknown asset'
  const workOrderSuffix = workOrderResult
    ? ` (Work order ${workOrderResult.workOrderNumber} created)`
    : ''

  for (const supervisor of supervisors) {
    // Don't notify the reporter if they're a supervisor
    if (supervisor.id === input.reportedById) continue

    await createNotification({
      organisationId: input.organisationId,
      userId: supervisor.id,
      type: 'defect_reported',
      title: `New ${input.severity} Defect Reported`,
      body: `${reporterName} reported a ${input.severity} defect on ${assetLabel}: ${input.title}${workOrderSuffix}`,
      link: `/defects/${result.id}`,
      isRead: false,
    })
    supervisorsNotified++
  }

  return {
    defect: {
      id: result.id,
      title: result.title,
      severity: result.severity,
      status: result.status,
    },
    workOrder: workOrderResult,
    supervisorsNotified,
  }
}

/**
 * Create defects from failed inspection items when an inspection is completed
 */
export async function escalateFailedInspectionItems(
  inspectionId: string,
  organisationId: string,
  operatorId: string,
): Promise<DefectEscalationResult[]> {
  // Get the inspection with failed items
  const inspection = await db.query.inspections.findFirst({
    where: eq(schema.inspections.id, inspectionId),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
        },
      },
      items: true,
    },
  })

  if (!inspection) {
    return []
  }

  // Filter for failed items only
  const failedItems = inspection.items.filter((item) => item.result === 'fail')

  if (failedItems.length === 0) {
    return []
  }

  const results: DefectEscalationResult[] = []

  for (const item of failedItems) {
    // Determine severity from the checklist item type
    // Photo/signature failures are generally critical (safety), others are major
    let severity: 'minor' | 'major' | 'critical' = 'major'
    if (item.checklistItemType === 'photo' || item.checklistItemType === 'signature') {
      severity = 'critical'
    }

    const result = await createDefectWithEscalation({
      organisationId,
      assetId: inspection.assetId,
      inspectionId,
      inspectionItemId: item.id,
      reportedById: operatorId,
      title: `Inspection Failed: ${item.checklistItemLabel}`,
      description: item.notes || undefined,
      category: 'inspection',
      severity,
      location: undefined,
      photos: item.photos ? JSON.stringify(item.photos) : undefined,
    })

    results.push(result)
  }

  return results
}
