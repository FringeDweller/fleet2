import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const updateChecklistItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')

  if (!id || !itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID and item ID are required',
    })
  }

  const body = await readBody(event)
  const result = updateChecklistItemSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Get existing item
  const existing = await db.query.workOrderChecklistItems.findFirst({
    where: and(
      eq(schema.workOrderChecklistItems.id, itemId),
      eq(schema.workOrderChecklistItems.workOrderId, id),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Checklist item not found',
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.title !== undefined) updateData.title = result.data.title
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.isRequired !== undefined) updateData.isRequired = result.data.isRequired
  if (result.data.notes !== undefined) updateData.notes = result.data.notes

  // Handle completion status change
  if (result.data.isCompleted !== undefined) {
    updateData.isCompleted = result.data.isCompleted
    if (result.data.isCompleted && !existing.isCompleted) {
      updateData.completedAt = new Date()
      updateData.completedById = session.user.id
    } else if (!result.data.isCompleted) {
      updateData.completedAt = null
      updateData.completedById = null
    }
  }

  const [item] = await db
    .update(schema.workOrderChecklistItems)
    .set(updateData)
    .where(
      and(
        eq(schema.workOrderChecklistItems.id, itemId),
        eq(schema.workOrderChecklistItems.workOrderId, id),
      ),
    )
    .returning()

  if (!item) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update checklist item',
    })
  }

  return item
})
