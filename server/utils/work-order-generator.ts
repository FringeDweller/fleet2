import { db, schema } from './db'
import { eq, and, gte, or, isNull, sql } from 'drizzle-orm'
import type { MaintenanceSchedule, Asset } from '../db/schema'
import { calculateNextDueDate } from './schedule-calculator'
import { createScheduledMaintenanceNotification } from './notifications'

export interface GenerationResult {
  scheduleId: string
  scheduleName: string
  workOrderId?: string
  workOrderNumber?: string
  assetId?: string
  assetNumber?: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

/**
 * Generate work order number for an organisation
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
 * Check if a work order was already generated for this schedule cycle
 */
async function wasWorkOrderGenerated(scheduleId: string, scheduledDate: Date): Promise<boolean> {
  const existing = await db.query.maintenanceScheduleWorkOrders.findFirst({
    where: and(
      eq(schema.maintenanceScheduleWorkOrders.scheduleId, scheduleId),
      eq(schema.maintenanceScheduleWorkOrders.scheduledDate, scheduledDate)
    )
  })
  return !!existing
}

/**
 * Generate a single work order from a maintenance schedule and asset
 */
export async function generateWorkOrderFromSchedule(
  schedule: MaintenanceSchedule,
  asset: Asset
): Promise<GenerationResult> {
  const result: GenerationResult = {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    status: 'skipped'
  }

  try {
    const today = new Date()
    let shouldGenerate = false
    let triggerReason = ''

    // Check time-based trigger
    if (schedule.scheduleType === 'time_based' || schedule.scheduleType === 'combined') {
      if (schedule.nextDueDate) {
        const leadDate = new Date(schedule.nextDueDate)
        leadDate.setDate(leadDate.getDate() - schedule.leadTimeDays)

        if (today >= leadDate) {
          shouldGenerate = true
          triggerReason = `Time-based: due ${schedule.nextDueDate.toISOString().split('T')[0]}`

          // Check if already generated for this due date
          const alreadyGenerated = await wasWorkOrderGenerated(schedule.id, schedule.nextDueDate)
          if (alreadyGenerated) {
            result.reason = `Already generated for ${schedule.nextDueDate.toISOString().split('T')[0]}`
            return result
          }
        }
      }
    }

    // Check usage-based trigger (mileage)
    if (schedule.scheduleType === 'usage_based' || schedule.scheduleType === 'combined') {
      if (schedule.intervalMileage && asset.mileage) {
        const currentMileage = Number(asset.mileage)
        const lastTriggered = Number(schedule.lastTriggeredMileage) || 0
        const nextTriggerMileage = lastTriggered + schedule.intervalMileage

        if (currentMileage >= nextTriggerMileage) {
          shouldGenerate = true
          triggerReason = triggerReason
            ? `${triggerReason} + Mileage: ${currentMileage} >= ${nextTriggerMileage}`
            : `Mileage: ${currentMileage} >= ${nextTriggerMileage}`
        }
      }

      // Check usage-based trigger (hours)
      if (schedule.intervalHours && asset.operationalHours) {
        const currentHours = Number(asset.operationalHours)
        const lastTriggered = Number(schedule.lastTriggeredHours) || 0
        const nextTriggerHours = lastTriggered + schedule.intervalHours

        if (currentHours >= nextTriggerHours) {
          shouldGenerate = true
          triggerReason = triggerReason
            ? `${triggerReason} + Hours: ${currentHours} >= ${nextTriggerHours}`
            : `Hours: ${currentHours} >= ${nextTriggerHours}`
        }
      }
    }

    if (!shouldGenerate) {
      result.reason = 'Not yet due'
      return result
    }

    // Generate work order number
    const workOrderNumber = await generateWorkOrderNumber(schedule.organisationId)

    // Prepare work order data
    const dueDate = schedule.nextDueDate || new Date()
    const workOrderData = {
      organisationId: schedule.organisationId,
      workOrderNumber,
      assetId: asset.id,
      templateId: schedule.templateId,
      assignedToId: schedule.defaultAssigneeId,
      createdById: schedule.createdById, // Use schedule creator as work order creator
      title: schedule.name,
      description: schedule.description,
      priority: schedule.defaultPriority as 'low' | 'medium' | 'high' | 'critical',
      status: 'open' as const,
      dueDate,
      notes: `Auto-generated from maintenance schedule: ${schedule.name}\nTrigger: ${triggerReason}`
    }

    // Create work order
    const [workOrder] = await db.insert(schema.workOrders).values(workOrderData).returning()

    if (!workOrder) {
      result.status = 'error'
      result.reason = 'Failed to create work order'
      return result
    }

    // Copy checklist items from template if available
    if (schedule.templateId) {
      const template = await db.query.taskTemplates.findFirst({
        where: eq(schema.taskTemplates.id, schedule.templateId)
      })

      if (template?.checklistItems && template.checklistItems.length > 0) {
        const checklistItems = template.checklistItems.map(item => ({
          workOrderId: workOrder.id,
          templateItemId: item.id,
          title: item.title,
          description: item.description || null,
          isRequired: item.isRequired,
          order: item.order
        }))

        await db.insert(schema.workOrderChecklistItems).values(checklistItems)
      }
    }

    // Create junction table record
    await db.insert(schema.maintenanceScheduleWorkOrders).values({
      scheduleId: schedule.id,
      workOrderId: workOrder.id,
      scheduledDate: dueDate
    })

    // Create status history entry
    await db.insert(schema.workOrderStatusHistory).values({
      workOrderId: workOrder.id,
      fromStatus: null,
      toStatus: 'open',
      changedById: schedule.createdById,
      notes: `Auto-generated from maintenance schedule: ${schedule.name}`
    })

    // Update schedule tracking fields
    const updates: Partial<typeof schema.maintenanceSchedules.$inferInsert> = {
      lastGeneratedAt: new Date(),
      updatedAt: new Date()
    }

    // Update time-based tracking
    if (schedule.scheduleType === 'time_based' || schedule.scheduleType === 'combined') {
      if (schedule.intervalType && schedule.nextDueDate) {
        updates.nextDueDate = calculateNextDueDate(
          schedule.intervalType,
          schedule.intervalValue,
          schedule.nextDueDate,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
          schedule.monthOfYear
        )
      }
    }

    // Update usage-based tracking
    if (schedule.scheduleType === 'usage_based' || schedule.scheduleType === 'combined') {
      if (schedule.intervalMileage && asset.mileage) {
        updates.lastTriggeredMileage = asset.mileage.toString()
      }
      if (schedule.intervalHours && asset.operationalHours) {
        updates.lastTriggeredHours = asset.operationalHours.toString()
      }
    }

    await db
      .update(schema.maintenanceSchedules)
      .set(updates)
      .where(eq(schema.maintenanceSchedules.id, schedule.id))

    // Log in audit log
    await db.insert(schema.auditLog).values({
      organisationId: schedule.organisationId,
      userId: schedule.createdById,
      action: 'create',
      entityType: 'work_order',
      entityId: workOrder.id,
      newValues: {
        ...workOrder,
        _metadata: {
          source: 'maintenance_schedule',
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          trigger: triggerReason
        }
      }
    })

    // Notify assignee if work order was assigned
    if (workOrder.assignedToId) {
      const assignee = await db.query.users.findFirst({
        where: eq(schema.users.id, workOrder.assignedToId)
      })

      if (assignee) {
        await createScheduledMaintenanceNotification({
          organisationId: schedule.organisationId,
          userId: workOrder.assignedToId,
          scheduleName: schedule.name,
          assetNumber: asset.assetNumber,
          workOrderNumber: workOrder.workOrderNumber,
          workOrderId: workOrder.id
        })
      }
    }

    result.status = 'created'
    result.workOrderId = workOrder.id
    result.workOrderNumber = workOrder.workOrderNumber
    result.reason = triggerReason

    return result
  } catch (error) {
    result.status = 'error'
    result.reason = error instanceof Error ? error.message : 'Unknown error'
    return result
  }
}

/**
 * Check all active schedules and generate work orders where due
 */
export async function generateScheduledWorkOrders(): Promise<GenerationResult[]> {
  const results: GenerationResult[] = []

  // Get all active, non-archived schedules
  const schedules = await db.query.maintenanceSchedules.findMany({
    where: and(
      eq(schema.maintenanceSchedules.isActive, true),
      eq(schema.maintenanceSchedules.isArchived, false),
      or(
        isNull(schema.maintenanceSchedules.endDate),
        gte(schema.maintenanceSchedules.endDate, new Date())
      )
    )
  })

  for (const schedule of schedules) {
    // Get assets for this schedule
    let assets: Asset[] = []

    if (schedule.assetId) {
      // Schedule is for specific asset
      const asset = await db.query.assets.findFirst({
        where: and(eq(schema.assets.id, schedule.assetId), eq(schema.assets.isArchived, false))
      })
      if (asset) assets = [asset]
    } else if (schedule.categoryId) {
      // Schedule is for all assets in category
      assets = await db.query.assets.findMany({
        where: and(
          eq(schema.assets.categoryId, schedule.categoryId),
          eq(schema.assets.isArchived, false)
        )
      })
    }

    // Generate work orders for each asset
    for (const asset of assets) {
      const result = await generateWorkOrderFromSchedule(schedule, asset)
      results.push(result)
    }
  }

  return results
}
