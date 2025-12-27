import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const onOrderSchema = z.object({
  quantity: z.number().min(0),
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const partId = getRouterParam(event, 'id')

  if (!partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part ID is required',
    })
  }

  const body = await readBody(event)
  const result = onOrderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify part exists and belongs to organisation
  const existingPart = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, partId),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
  })

  if (!existingPart) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  const now = new Date()
  const updateData: Record<string, unknown> = {
    updatedAt: now,
  }

  if (result.data.quantity > 0) {
    updateData.onOrderQuantity = result.data.quantity.toFixed(2)
    updateData.onOrderDate = now
    updateData.onOrderNotes = result.data.notes || null
  } else {
    // Clear on-order status
    updateData.onOrderQuantity = '0'
    updateData.onOrderDate = null
    updateData.onOrderNotes = null
  }

  const [updated] = await db
    .update(schema.parts)
    .set(updateData)
    .where(
      and(
        eq(schema.parts.id, partId),
        eq(schema.parts.organisationId, session.user.organisationId),
      ),
    )
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: result.data.quantity > 0 ? 'mark_on_order' : 'clear_on_order',
    entityType: 'part',
    entityId: partId,
    oldValues: {
      onOrderQuantity: existingPart.onOrderQuantity,
      onOrderDate: existingPart.onOrderDate,
    },
    newValues: {
      onOrderQuantity: updateData.onOrderQuantity,
      onOrderDate: updateData.onOrderDate,
    },
  })

  return updated
})
