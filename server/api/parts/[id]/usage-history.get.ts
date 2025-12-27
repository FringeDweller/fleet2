import { and, desc, eq, sql } from 'drizzle-orm'
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
      statusMessage: 'Part ID is required',
    })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string) || 0, 0)

  // Verify part exists and belongs to org
  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, id),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.partUsageHistory)
    .where(eq(schema.partUsageHistory.partId, id))

  const total = countResult[0]?.count || 0

  // Get usage history
  const history = await db.query.partUsageHistory.findMany({
    where: eq(schema.partUsageHistory.partId, id),
    orderBy: desc(schema.partUsageHistory.createdAt),
    limit,
    offset,
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
  })

  return {
    data: history,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + history.length < total,
    },
  }
})
