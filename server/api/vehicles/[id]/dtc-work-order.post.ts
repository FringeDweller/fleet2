import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { createWorkOrderAssignedNotification } from '../../../utils/notifications'
import { requirePermission } from '../../../utils/permissions'

/**
 * DTC code information for work order creation
 */
const dtcCodeSchema = z.object({
  code: z.string().min(1, 'DTC code is required').max(10),
  codeType: z.enum(['P', 'C', 'B', 'U']).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
})

const createDtcWorkOrderSchema = z.object({
  dtcCodes: z.array(dtcCodeSchema).min(1, 'At least one DTC code is required'),
  // Optional overrides
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Rule-based creation (optional - if a matching rule triggered this)
  ruleId: z.string().uuid().optional().nullable(),
})

/**
 * Map DTC severity to work order priority
 */
function mapSeverityToPriority(
  severity: 'info' | 'warning' | 'critical',
): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity) {
    case 'info':
      return 'low'
    case 'warning':
      return 'medium'
    case 'critical':
      return 'critical'
    default:
      return 'medium'
  }
}

/**
 * Determine highest severity from multiple DTC codes
 */
function getHighestSeverity(
  dtcCodes: Array<{ severity?: 'info' | 'warning' | 'critical' }>,
): 'info' | 'warning' | 'critical' {
  const severityOrder = { info: 0, warning: 1, critical: 2 }
  let highest: 'info' | 'warning' | 'critical' = 'info'

  for (const dtc of dtcCodes) {
    const severity = dtc.severity || 'warning'
    if (severityOrder[severity] > severityOrder[highest]) {
      highest = severity
    }
  }

  return highest
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
 * POST /api/vehicles/[id]/dtc-work-order
 *
 * Create a work order from DTC (Diagnostic Trouble Code) codes detected on a vehicle.
 * This endpoint:
 * - Accepts one or more DTC codes with severity information
 * - Creates a work order for the vehicle
 * - Links the DTC codes as the reason for the work order
 * - Sets appropriate priority based on the highest DTC severity
 * - Records the DTC-to-work-order relationship for tracking
 */
export default defineEventHandler(async (event) => {
  // Require work_orders:write permission
  const user = await requirePermission(event, 'work_orders:write')

  const vehicleId = getRouterParam(event, 'id')

  if (!vehicleId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vehicle ID is required',
    })
  }

  const body = await readBody(event)
  const result = createDtcWorkOrderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify vehicle exists and belongs to the organisation
  const vehicle = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, vehicleId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
      make: true,
      model: true,
      year: true,
      licensePlate: true,
    },
  })

  if (!vehicle) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vehicle not found',
    })
  }

  const { dtcCodes, priority, assignedToId, dueDate, notes, ruleId } = result.data

  // Determine priority from DTC severity if not explicitly provided
  const highestSeverity = getHighestSeverity(dtcCodes)
  const workOrderPriority = priority || mapSeverityToPriority(highestSeverity)

  // Build work order title from DTC codes
  const dtcCodeList = dtcCodes.map((d) => d.code).join(', ')
  const title = dtcCodes.length === 1 ? `DTC: ${dtcCodeList}` : `DTC Codes: ${dtcCodeList}`

  // Build description from DTC details
  const descriptionLines = dtcCodes.map((dtc) => {
    const severityLabel = dtc.severity?.toUpperCase() || 'WARNING'
    const desc = dtc.description || 'No description available'
    return `- ${dtc.code} [${severityLabel}]: ${desc}`
  })
  const description = `Diagnostic trouble codes detected:\n\n${descriptionLines.join('\n')}`

  // Generate work order number
  const workOrderNumber = await generateWorkOrderNumber(user.organisationId)

  // Create the work order
  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      organisationId: user.organisationId,
      workOrderNumber,
      assetId: vehicleId,
      assignedToId: assignedToId || null,
      createdById: user.id,
      title,
      description,
      priority: workOrderPriority,
      status: 'open', // DTC work orders start as open (not draft)
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    })
    .returning()

  if (!workOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create work order',
    })
  }

  // Record the DTC-to-work-order relationship for each code
  // This prevents duplicate work orders for the same DTC and enables tracking
  const historyEntries = dtcCodes.map((dtc) => ({
    organisationId: user.organisationId,
    dtcCode: dtc.code,
    dtcDescription: dtc.description || null,
    dtcSeverity: dtc.severity || 'warning',
    assetId: vehicleId,
    ruleId: ruleId || null,
    workOrderId: workOrder.id,
    status: 'active',
    detectedAt: new Date(),
  }))

  await db.insert(schema.dtcWorkOrderHistory).values(historyEntries)

  // Create initial status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: workOrder.id,
    fromStatus: null,
    toStatus: 'open',
    changedById: user.id,
    notes: `Work order created from ${dtcCodes.length} DTC code(s): ${dtcCodeList}`,
  })

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrder.id,
    newValues: {
      ...workOrder,
      source: 'dtc',
      dtcCodes: dtcCodes.map((d) => d.code),
    },
  })

  // Notify assignee if work order was created with an assignment
  if (workOrder.assignedToId && workOrder.assignedToId !== user.id) {
    await createWorkOrderAssignedNotification({
      organisationId: user.organisationId,
      userId: workOrder.assignedToId,
      workOrderNumber: workOrder.workOrderNumber,
      workOrderTitle: workOrder.title,
      workOrderId: workOrder.id,
      assignedByName: `${user.firstName} ${user.lastName}`,
    })
  }

  return {
    workOrder: {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      description: workOrder.description,
      priority: workOrder.priority,
      status: workOrder.status,
      dueDate: workOrder.dueDate,
      assignedToId: workOrder.assignedToId,
      createdAt: workOrder.createdAt,
    },
    vehicle: {
      id: vehicle.id,
      assetNumber: vehicle.assetNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
    },
    dtcCodes: dtcCodes.map((d) => ({
      code: d.code,
      severity: d.severity || 'warning',
      description: d.description || null,
    })),
  }
})
