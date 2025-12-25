import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { eq, and } from 'drizzle-orm'

const createPartSchema = z.object({
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional().nullable(),
  quantity: z.number().int().positive().default(1),
  unitCost: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
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
  const result = createPartSchema.safeParse(body)

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

  // Calculate total cost
  const totalCost = result.data.unitCost
    ? (result.data.unitCost * result.data.quantity).toFixed(2)
    : null

  const [part] = await db
    .insert(schema.workOrderParts)
    .values({
      workOrderId: id,
      partName: result.data.partName,
      partNumber: result.data.partNumber,
      quantity: result.data.quantity,
      unitCost: result.data.unitCost?.toFixed(2),
      totalCost,
      notes: result.data.notes,
      addedById: session.user.id
    })
    .returning()

  if (!part) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add part'
    })
  }

  return part
})
