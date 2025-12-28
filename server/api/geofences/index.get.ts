import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission (geofences are related to asset tracking)
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filters
  const search = query.search as string | undefined
  const category = query.category as string | undefined
  const isActive = query.isActive as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = ['name', 'category', 'type', 'isActive', 'createdAt', 'updatedAt']

  const conditions = [eq(schema.geofences.organisationId, user.organisationId)]

  // Filter by active status
  if (isActive === 'true') {
    conditions.push(eq(schema.geofences.isActive, true))
  } else if (isActive === 'false') {
    conditions.push(eq(schema.geofences.isActive, false))
  }

  // Filter by category
  if (
    category &&
    [
      'work_site',
      'depot',
      'restricted_zone',
      'customer_location',
      'fuel_station',
      'other',
    ].includes(category)
  ) {
    conditions.push(
      eq(
        schema.geofences.category,
        category as
          | 'work_site'
          | 'depot'
          | 'restricted_zone'
          | 'customer_location'
          | 'fuel_station'
          | 'other',
      ),
    )
  }

  // Search by name or description
  if (search) {
    conditions.push(
      or(
        ilike(schema.geofences.name, `%${search}%`),
        ilike(schema.geofences.description, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.geofences)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort field
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const geofences = await db.query.geofences.findMany({
    where: whereClause,
    orderBy: (geofences) => [sortFn(geofences[sortField as keyof typeof geofences])],
    limit,
    offset,
  })

  return {
    data: geofences,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + geofences.length < total,
    },
  }
})
