/**
 * DTC Work Order Service (US-10.7)
 *
 * Handles automatic work order creation from DTC detection.
 * Includes rule matching, duplicate prevention, and priority mapping.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { DtcWorkOrderRule } from '../db/schema'
import { db, schema } from './db'
import { createNotification } from './notifications'

/**
 * DTC severity levels and their corresponding work order priorities
 */
const SEVERITY_TO_PRIORITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  critical: 'critical',
  severe: 'high',
  moderate: 'medium',
  minor: 'low',
  unknown: 'medium',
}

/**
 * Standard OBD-II DTC code prefixes and their meanings
 */
const DTC_SYSTEM_PREFIXES = {
  P0: { system: 'Powertrain', type: 'Generic' },
  P1: { system: 'Powertrain', type: 'Manufacturer' },
  P2: { system: 'Powertrain', type: 'Generic' },
  P3: { system: 'Powertrain', type: 'Generic/Manufacturer' },
  C0: { system: 'Chassis', type: 'Generic' },
  C1: { system: 'Chassis', type: 'Manufacturer' },
  C2: { system: 'Chassis', type: 'Manufacturer' },
  C3: { system: 'Chassis', type: 'Generic' },
  B0: { system: 'Body', type: 'Generic' },
  B1: { system: 'Body', type: 'Manufacturer' },
  B2: { system: 'Body', type: 'Manufacturer' },
  B3: { system: 'Body', type: 'Generic' },
  U0: { system: 'Network', type: 'Generic' },
  U1: { system: 'Network', type: 'Manufacturer' },
  U2: { system: 'Network', type: 'Manufacturer' },
  U3: { system: 'Network', type: 'Generic' },
}

export interface DetectedDtc {
  code: string
  description?: string
  severity?: 'critical' | 'severe' | 'moderate' | 'minor' | 'unknown'
  isPending?: boolean
  isConfirmed?: boolean
}

export interface DtcProcessingResult {
  dtcCode: string
  action: 'created' | 'skipped' | 'duplicate' | 'no_rule' | 'error'
  workOrderId?: string
  workOrderNumber?: string
  reason?: string
  ruleId?: string
}

/**
 * Get DTC system info from code prefix
 */
export function getDtcSystemInfo(dtcCode: string): { system: string; type: string } | null {
  const prefix = dtcCode.substring(0, 2).toUpperCase()
  return DTC_SYSTEM_PREFIXES[prefix as keyof typeof DTC_SYSTEM_PREFIXES] || null
}

/**
 * Estimate severity from DTC code if not provided
 * This is a basic heuristic - real implementation would use a DTC database
 */
export function estimateDtcSeverity(dtcCode: string): 'critical' | 'severe' | 'moderate' | 'minor' {
  const code = dtcCode.toUpperCase()

  // Critical codes - typically safety or major system failures
  if (
    code.startsWith('P0') &&
    ['P0300', 'P0301', 'P0302', 'P0303', 'P0304'].includes(code) // Misfire codes
  ) {
    return 'severe'
  }

  // Engine overheating
  if (code === 'P0217' || code === 'P0218') {
    return 'critical'
  }

  // Oil pressure issues
  if (code.startsWith('P052')) {
    return 'critical'
  }

  // Transmission issues
  if (code.startsWith('P07')) {
    return 'severe'
  }

  // ABS/Braking issues
  if (code.startsWith('C0')) {
    return 'severe'
  }

  // Emissions codes
  if (code.startsWith('P04')) {
    return 'moderate'
  }

  // Default to moderate
  return 'moderate'
}

/**
 * Find matching rules for a DTC code
 */
async function findMatchingRules(
  organisationId: string,
  dtcCode: string,
): Promise<DtcWorkOrderRule[]> {
  const code = dtcCode.toUpperCase()

  // Get all active rules for the organisation
  const rules = await db.query.dtcWorkOrderRules.findMany({
    where: and(
      eq(schema.dtcWorkOrderRules.organisationId, organisationId),
      eq(schema.dtcWorkOrderRules.isActive, true),
    ),
  })

  // Filter rules that match the DTC code
  return rules.filter((rule) => {
    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.dtcPattern, 'i')
        return regex.test(code)
      } catch {
        // Invalid regex, skip this rule
        console.error(`Invalid regex pattern in rule ${rule.id}: ${rule.dtcPattern}`)
        return false
      }
    } else {
      // Exact match (case-insensitive)
      return rule.dtcPattern.toUpperCase() === code
    }
  })
}

/**
 * Check if an open work order already exists for this DTC on this asset
 */
async function hasOpenWorkOrderForDtc(
  organisationId: string,
  assetId: string,
  dtcCode: string,
): Promise<boolean> {
  const existing = await db.query.dtcWorkOrderHistory.findFirst({
    where: and(
      eq(schema.dtcWorkOrderHistory.organisationId, organisationId),
      eq(schema.dtcWorkOrderHistory.assetId, assetId),
      eq(schema.dtcWorkOrderHistory.dtcCode, dtcCode.toUpperCase()),
      eq(schema.dtcWorkOrderHistory.status, 'active'),
    ),
  })

  return !!existing
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
 * Create a work order from a DTC
 */
async function createWorkOrderFromDtc(
  organisationId: string,
  assetId: string,
  dtc: DetectedDtc,
  rule: DtcWorkOrderRule,
  createdById: string,
): Promise<{ workOrderId: string; workOrderNumber: string }> {
  const severity = dtc.severity || estimateDtcSeverity(dtc.code)
  const systemInfo = getDtcSystemInfo(dtc.code)

  // Determine priority
  let priority: 'low' | 'medium' | 'high' | 'critical'
  if (rule.priorityMapping === 'fixed' && rule.fixedPriority) {
    priority = rule.fixedPriority as 'low' | 'medium' | 'high' | 'critical'
  } else {
    priority = SEVERITY_TO_PRIORITY[severity] || 'medium'
  }

  // Generate work order number
  const workOrderNumber = await generateWorkOrderNumber(organisationId)

  // Get asset details for the work order title
  const asset = await db.query.assets.findFirst({
    where: eq(schema.assets.id, assetId),
    columns: { assetNumber: true },
  })

  // Build work order title
  const title =
    rule.workOrderTitle ||
    `DTC ${dtc.code}: ${dtc.description || systemInfo?.system || 'Diagnostic Code Detected'}`

  // Build work order description
  const description =
    rule.workOrderDescription ||
    [
      `Diagnostic Trouble Code detected: ${dtc.code}`,
      dtc.description ? `Description: ${dtc.description}` : null,
      systemInfo ? `System: ${systemInfo.system} (${systemInfo.type})` : null,
      `Severity: ${severity}`,
      dtc.isPending ? 'Status: Pending' : dtc.isConfirmed ? 'Status: Confirmed' : null,
      '',
      'This work order was automatically created based on DTC detection rules.',
    ]
      .filter(Boolean)
      .join('\n')

  // Create work order in transaction
  const result = await db.transaction(async (tx) => {
    // Create work order
    const [workOrder] = await tx
      .insert(schema.workOrders)
      .values({
        organisationId,
        workOrderNumber,
        assetId,
        templateId: rule.templateId || null,
        assignedToId: rule.autoAssignToId || null,
        createdById,
        title,
        description,
        priority,
        status: 'open',
        notes: `Auto-generated from DTC: ${dtc.code} (Rule: ${rule.name})`,
      })
      .returning()

    if (!workOrder) {
      throw new Error('Failed to create work order')
    }

    // Copy template checklist if template specified
    if (rule.templateId) {
      const template = await tx.query.taskTemplates.findFirst({
        where: eq(schema.taskTemplates.id, rule.templateId),
        with: {
          templateParts: {
            with: {
              part: {
                columns: {
                  id: true,
                  name: true,
                  sku: true,
                  unitCost: true,
                },
              },
            },
          },
        },
      })

      // Copy checklist items
      if (template?.checklistItems && template.checklistItems.length > 0) {
        const checklistItems = template.checklistItems.map((item) => ({
          workOrderId: workOrder.id,
          templateItemId: item.id,
          title: item.title,
          description: item.description || null,
          isRequired: item.isRequired,
          order: item.order,
        }))

        await tx.insert(schema.workOrderChecklistItems).values(checklistItems)
      }

      // Copy parts from template
      if (template?.templateParts && template.templateParts.length > 0) {
        const partsToCreate = template.templateParts.map((tp) => {
          const quantity = parseInt(tp.quantity, 10) || 1
          const unitCost = tp.part?.unitCost ? parseFloat(tp.part.unitCost) : null
          const totalCost = unitCost ? (unitCost * quantity).toFixed(2) : null

          return {
            workOrderId: workOrder.id,
            partId: tp.part?.id || null,
            partName: tp.part?.name || 'Unknown Part',
            partNumber: tp.part?.sku || null,
            quantity,
            unitCost: unitCost?.toFixed(2) || null,
            totalCost,
            notes: `From DTC rule: ${rule.name}`,
            addedById: createdById,
          }
        })

        await tx.insert(schema.workOrderParts).values(partsToCreate)
      }
    }

    // Create DTC history record
    await tx.insert(schema.dtcWorkOrderHistory).values({
      organisationId,
      dtcCode: dtc.code.toUpperCase(),
      dtcDescription: dtc.description || null,
      dtcSeverity: severity,
      assetId,
      ruleId: rule.id,
      workOrderId: workOrder.id,
      status: 'active',
    })

    // Create status history entry
    await tx.insert(schema.workOrderStatusHistory).values({
      workOrderId: workOrder.id,
      fromStatus: null,
      toStatus: 'open',
      changedById: createdById,
      notes: `Auto-created from DTC: ${dtc.code}`,
    })

    // Log in audit log
    await tx.insert(schema.auditLog).values({
      organisationId,
      userId: createdById,
      action: 'create',
      entityType: 'work_order',
      entityId: workOrder.id,
      newValues: {
        ...workOrder,
        _metadata: {
          source: 'dtc_detection',
          dtcCode: dtc.code,
          dtcDescription: dtc.description,
          dtcSeverity: severity,
          ruleId: rule.id,
          ruleName: rule.name,
        },
      },
    })

    return workOrder
  })

  // Notify assignee if auto-assigned
  if (rule.autoAssignToId) {
    await createNotification({
      organisationId,
      userId: rule.autoAssignToId,
      type: 'work_order_assigned',
      title: 'DTC Work Order Created',
      body: `Work order ${workOrderNumber} created for ${asset?.assetNumber || 'asset'} - DTC: ${dtc.code}`,
      link: `/work-orders/${result.id}`,
      isRead: false,
    })
  }

  return {
    workOrderId: result.id,
    workOrderNumber: result.workOrderNumber,
  }
}

/**
 * Process a detected DTC and create work order if rules match
 */
export async function processDtc(
  organisationId: string,
  assetId: string,
  dtc: DetectedDtc,
  createdById: string,
): Promise<DtcProcessingResult> {
  const code = dtc.code.toUpperCase()

  try {
    // Check for duplicate (open work order already exists)
    const hasDuplicate = await hasOpenWorkOrderForDtc(organisationId, assetId, code)
    if (hasDuplicate) {
      return {
        dtcCode: code,
        action: 'duplicate',
        reason: 'An open work order already exists for this DTC on this asset',
      }
    }

    // Find matching rules
    const matchingRules = await findMatchingRules(organisationId, code)
    if (matchingRules.length === 0) {
      return {
        dtcCode: code,
        action: 'no_rule',
        reason: 'No matching DTC rules configured for this code',
      }
    }

    // Use the first matching rule (most specific should be listed first)
    const rule = matchingRules[0]!

    // Check if rule should create work order
    if (!rule.shouldCreateWorkOrder) {
      return {
        dtcCode: code,
        action: 'skipped',
        reason: `Rule "${rule.name}" matched but work order creation is disabled`,
        ruleId: rule.id,
      }
    }

    // Create work order
    const { workOrderId, workOrderNumber } = await createWorkOrderFromDtc(
      organisationId,
      assetId,
      dtc,
      rule,
      createdById,
    )

    return {
      dtcCode: code,
      action: 'created',
      workOrderId,
      workOrderNumber,
      ruleId: rule.id,
      reason: `Work order created from rule "${rule.name}"`,
    }
  } catch (error) {
    console.error(`Error processing DTC ${code}:`, error)
    return {
      dtcCode: code,
      action: 'error',
      reason: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process multiple DTCs at once
 */
export async function processMultipleDtcs(
  organisationId: string,
  assetId: string,
  dtcs: DetectedDtc[],
  createdById: string,
): Promise<DtcProcessingResult[]> {
  const results: DtcProcessingResult[] = []

  for (const dtc of dtcs) {
    const result = await processDtc(organisationId, assetId, dtc, createdById)
    results.push(result)
  }

  return results
}

/**
 * Mark DTC work order history as resolved when work order is completed
 */
export async function resolveDtcWorkOrderHistory(workOrderId: string): Promise<void> {
  await db
    .update(schema.dtcWorkOrderHistory)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
    })
    .where(eq(schema.dtcWorkOrderHistory.workOrderId, workOrderId))
}
