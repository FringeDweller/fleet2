import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { createWorkOrderAssignedNotification } from '../../utils/notifications'
import { requirePermission } from '../../utils/permissions'

const createWorkOrderSchema = z.object({
  assetId: z.string().uuid('Asset is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['draft', 'open']).default('draft'),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
})

async function generateWorkOrderNumber(organisationId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.workOrders)
    .where(eq(schema.workOrders.organisationId, organisationId))

  const count = result[0]?.count ?? 0
  const nextNumber = count + 1
  return `WO-${nextNumber.toString().padStart(4, '0')}`
}

export default defineEventHandler(async (event) => {
  // Require work_orders:write permission to create work orders
  const user = await requirePermission(event, 'work_orders:write')

  const body = await readBody(event)
  const result = createWorkOrderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const workOrderNumber = await generateWorkOrderNumber(user.organisationId)

  // If a template is selected, copy its checklist items and parts
  let checklistItemsToCreate: Array<{
    workOrderId: string
    templateItemId: string
    title: string
    description: string | null
    isRequired: boolean
    order: number
  }> = []

  let partsToCreate: Array<{
    workOrderId: string
    partId: string | null
    partName: string
    partNumber: string | null
    quantity: number
    unitCost: string | null
    totalCost: string | null
    notes: string | null
    addedById: string
  }> = []

  if (result.data.templateId) {
    const template = await db.query.taskTemplates.findFirst({
      where: and(
        eq(schema.taskTemplates.id, result.data.templateId),
        eq(schema.taskTemplates.organisationId, user.organisationId),
      ),
      with: {
        // Get normalized template parts with full part details
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

    if (template?.checklistItems) {
      checklistItemsToCreate = template.checklistItems.map((item) => ({
        workOrderId: '', // Will be set after work order is created
        templateItemId: item.id,
        title: item.title,
        description: item.description || null,
        isRequired: item.isRequired,
        order: item.order,
      }))
    }

    // Copy parts from template - prefer normalized templateParts, fallback to JSONB requiredParts
    if (template?.templateParts && template.templateParts.length > 0) {
      // Use normalized template parts (linked to inventory)
      partsToCreate = template.templateParts.map((tp) => {
        const quantity = parseInt(tp.quantity, 10) || 1
        const unitCost = tp.part?.unitCost ? parseFloat(tp.part.unitCost) : null
        const totalCost = unitCost ? (unitCost * quantity).toFixed(2) : null

        return {
          workOrderId: '',
          partId: tp.part?.id || null,
          partName: tp.part?.name || 'Unknown Part',
          partNumber: tp.part?.sku || null,
          quantity,
          unitCost: unitCost?.toFixed(2) || null,
          totalCost,
          notes: tp.notes ? `From template: ${tp.notes}` : `From template: ${template.name}`,
          addedById: user!.id,
        }
      })
    } else if (template?.requiredParts && template.requiredParts.length > 0) {
      // Fallback to JSONB required parts (not linked to inventory)
      partsToCreate = template.requiredParts.map((rp) => {
        const quantity = rp.quantity || 1
        const unitCost = rp.estimatedCost || null
        const totalCost = unitCost ? (unitCost * quantity).toFixed(2) : null

        return {
          workOrderId: '',
          partId: null, // No inventory link for JSONB parts
          partName: rp.partName,
          partNumber: rp.partNumber || null,
          quantity,
          unitCost: unitCost?.toFixed(2) || null,
          totalCost,
          notes: rp.notes ? `From template: ${rp.notes}` : `From template: ${template.name}`,
          addedById: user!.id,
        }
      })
    }
  }

  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      organisationId: user.organisationId,
      workOrderNumber,
      assetId: result.data.assetId,
      templateId: result.data.templateId,
      assignedToId: result.data.assignedToId,
      createdById: user.id,
      title: result.data.title,
      description: result.data.description,
      priority: result.data.priority,
      status: result.data.status,
      dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
      estimatedDuration: result.data.estimatedDuration,
      notes: result.data.notes,
    })
    .returning()

  if (!workOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create work order',
    })
  }

  // Create checklist items if template was selected
  if (checklistItemsToCreate.length > 0) {
    await db.insert(schema.workOrderChecklistItems).values(
      checklistItemsToCreate.map((item) => ({
        ...item,
        workOrderId: workOrder.id,
      })),
    )
  }

  // Create parts if template was selected
  if (partsToCreate.length > 0) {
    await db.insert(schema.workOrderParts).values(
      partsToCreate.map((part) => ({
        ...part,
        workOrderId: workOrder.id,
      })),
    )
  }

  // Create initial status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: workOrder.id,
    fromStatus: null,
    toStatus: result.data.status,
    changedById: user.id,
    notes: 'Work order created',
  })

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrder.id,
    newValues: workOrder,
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

  return workOrder
})
