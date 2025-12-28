import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
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
  const search = query.search as string | undefined
  const type = query.type as string | undefined
  const parentId = query.parentId as string | undefined
  const includeInactive = query.includeInactive === 'true'

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'name'
  const sortOrder = (query.sortOrder as string) || 'asc'
  const validSortFields = ['name', 'code', 'type', 'createdAt', 'updatedAt']

  const conditions = [eq(schema.storageLocations.organisationId, session.user.organisationId)]

  if (!includeInactive) {
    conditions.push(eq(schema.storageLocations.isActive, true))
  }

  if (type) {
    conditions.push(eq(schema.storageLocations.type, type as any))
  }

  if (parentId) {
    if (parentId === 'null') {
      // Filter for root-level locations (no parent)
      conditions.push(eq(schema.storageLocations.parentId, null as any))
    } else {
      conditions.push(eq(schema.storageLocations.parentId, parentId))
    }
  }

  // Global search
  if (search) {
    conditions.push(
      ilike(schema.storageLocations.name, `%${search}%`) ||
        ilike(schema.storageLocations.code, `%${search}%`) ||
        ilike(schema.storageLocations.description, `%${search}%`),
    )
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.storageLocations)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort field
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const locations = await db.query.storageLocations.findMany({
    where: whereClause,
    with: {
      parent: true,
    },
    orderBy: (locations) => [sortFn(locations[sortField as keyof typeof locations])],
    limit,
    offset,
  })

  return {
    data: locations,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + locations.length < total,
    },
  }
})
