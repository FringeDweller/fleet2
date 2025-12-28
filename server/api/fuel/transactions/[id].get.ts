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

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID is required',
    })
  }

  const transaction = await db.query.fuelTransactions.findFirst({
    where: and(
      eq(schema.fuelTransactions.id, id),
      eq(schema.fuelTransactions.organisationId, session.user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
        },
      },
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  })

  if (!transaction) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fuel transaction not found',
    })
  }

  return transaction
})
