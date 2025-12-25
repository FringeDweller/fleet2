import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and, sql } from 'drizzle-orm'

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
  notes: z.string().optional().nullable()
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
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createWorkOrderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const workOrderNumber = await generateWorkOrderNumber(session.user.organisationId)

  // If a template is selected, copy its checklist items
  let checklistItemsToCreate: Array<{
    workOrderId: string
    templateItemId: string
    title: string
    description: string | null
    isRequired: boolean
    order: number
  }> = []

  if (result.data.templateId) {
    const template = await db.query.taskTemplates.findFirst({
      where: and(
        eq(schema.taskTemplates.id, result.data.templateId),
        eq(schema.taskTemplates.organisationId, session.user.organisationId)
      )
    })

    if (template?.checklistItems) {
      checklistItemsToCreate = template.checklistItems.map(item => ({
        workOrderId: '', // Will be set after work order is created
        templateItemId: item.id,
        title: item.title,
        description: item.description || null,
        isRequired: item.isRequired,
        order: item.order
      }))
    }
  }

  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      organisationId: session.user.organisationId,
      workOrderNumber,
      assetId: result.data.assetId,
      templateId: result.data.templateId,
      assignedToId: result.data.assignedToId,
      createdById: session.user.id,
      title: result.data.title,
      description: result.data.description,
      priority: result.data.priority,
      status: result.data.status,
      dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
      estimatedDuration: result.data.estimatedDuration,
      notes: result.data.notes
    })
    .returning()

  if (!workOrder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create work order'
    })
  }

  // Create checklist items if template was selected
  if (checklistItemsToCreate.length > 0) {
    await db.insert(schema.workOrderChecklistItems).values(
      checklistItemsToCreate.map(item => ({
        ...item,
        workOrderId: workOrder.id
      }))
    )
  }

  // Create initial status history entry
  await db.insert(schema.workOrderStatusHistory).values({
    workOrderId: workOrder.id,
    fromStatus: null,
    toStatus: result.data.status,
    changedById: session.user.id,
    notes: 'Work order created'
  })

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrder.id,
    newValues: workOrder
  })

  return workOrder
})
