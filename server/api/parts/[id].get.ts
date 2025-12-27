import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

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
      statusMessage: 'Part ID is required',
    })
  }

  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, id),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
    with: {
      category: true,
      usageHistory: {
        orderBy: desc(schema.partUsageHistory.createdAt),
        limit: 20,
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          workOrder: {
            columns: {
              id: true,
              workOrderNumber: true,
              title: true,
            },
          },
        },
      },
    },
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  return part
})
