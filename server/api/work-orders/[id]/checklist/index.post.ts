import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { eq, and, sql } from 'drizzle-orm'

const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().default(false)
})

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required'
    })
  }

  const body = await readBody(event)
  const result = createChecklistItemSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId)
    ),
    columns: { id: true }
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found'
    })
  }

  // Get the max order value
  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${schema.workOrderChecklistItems.order}), -1)` })
    .from(schema.workOrderChecklistItems)
    .where(eq(schema.workOrderChecklistItems.workOrderId, id))

  const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1

  const [item] = await db
    .insert(schema.workOrderChecklistItems)
    .values({
      workOrderId: id,
      title: result.data.title,
      description: result.data.description,
      isRequired: result.data.isRequired,
      order: nextOrder
    })
    .returning()

  if (!item) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create checklist item'
    })
  }

  return item
})
