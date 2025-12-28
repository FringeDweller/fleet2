import { and, desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)

  // Filters
  const partId = query.partId as string | undefined
  const locationId = query.locationId as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  const conditions = [eq(schema.inventoryTransfers.organisationId, session.user.organisationId)]

  if (partId) {
    conditions.push(eq(schema.inventoryTransfers.partId, partId))
  }

  if (locationId) {
    // Show transfers either from or to this location
    conditions.push(
      sql`${schema.inventoryTransfers.fromLocationId} = ${locationId} OR ${schema.inventoryTransfers.toLocationId} = ${locationId}`,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.inventoryTransfers)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Get transfers with relations
  const transfers = await db.query.inventoryTransfers.findMany({
    where: whereClause,
    with: {
      part: true,
      fromLocation: true,
      toLocation: true,
      transferredBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: desc(schema.inventoryTransfers.createdAt),
    limit,
    offset,
  })

  return {
    data: transfers,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + transfers.length < total,
    },
  }
})
