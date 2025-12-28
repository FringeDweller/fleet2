import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID is required',
    })
  }

  // Find existing transaction
  const existing = await db.query.fuelTransactions.findFirst({
    where: and(
      eq(schema.fuelTransactions.id, id),
      eq(schema.fuelTransactions.organisationId, user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fuel transaction not found',
    })
  }

  // Delete transaction
  await db.transaction(async (tx) => {
    await tx.delete(schema.fuelTransactions).where(eq(schema.fuelTransactions.id, id))

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'delete',
      entityType: 'fuel_transaction',
      entityId: id,
      oldValues: existing,
    })
  })

  return { success: true }
})
