import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
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

  // Basic filters
  const search = query.search as string | undefined
  const categoryId = query.categoryId as string | undefined
  const includeInactive = query.includeInactive === 'true'
  const lowStock = query.lowStock === 'true'

  // Advanced filters
  const supplier = query.supplier as string | undefined
  const location = query.location as string | undefined
  const minCost = query.minCost ? parseFloat(query.minCost as string) : undefined
  const maxCost = query.maxCost ? parseFloat(query.maxCost as string) : undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'name'
  const sortOrder = (query.sortOrder as string) || 'asc'
  const validSortFields = [
    'sku',
    'name',
    'quantityInStock',
    'unitCost',
    'supplier',
    'location',
    'createdAt',
    'updatedAt',
  ]

  const conditions = [eq(schema.parts.organisationId, session.user.organisationId)]

  if (!includeInactive) {
    conditions.push(eq(schema.parts.isActive, true))
  }

  if (categoryId) {
    conditions.push(eq(schema.parts.categoryId, categoryId))
  }

  // Low stock filter - parts at or below reorder threshold
  if (lowStock) {
    conditions.push(
      sql`CAST(${schema.parts.quantityInStock} AS NUMERIC) <= COALESCE(CAST(${schema.parts.reorderThreshold} AS NUMERIC), 0)`,
    )
  }

  // Global search across multiple fields
  if (search) {
    conditions.push(
      or(
        ilike(schema.parts.sku, `%${search}%`),
        ilike(schema.parts.name, `%${search}%`),
        ilike(schema.parts.description, `%${search}%`),
        ilike(schema.parts.supplier, `%${search}%`),
        ilike(schema.parts.supplierPartNumber, `%${search}%`),
        ilike(schema.parts.location, `%${search}%`),
      )!,
    )
  }

  // Advanced filters
  if (supplier) {
    conditions.push(ilike(schema.parts.supplier, `%${supplier}%`))
  }

  if (location) {
    conditions.push(ilike(schema.parts.location, `%${location}%`))
  }

  if (minCost && !Number.isNaN(minCost)) {
    conditions.push(gte(sql`CAST(${schema.parts.unitCost} AS NUMERIC)`, minCost))
  }

  if (maxCost && !Number.isNaN(maxCost)) {
    conditions.push(lte(sql`CAST(${schema.parts.unitCost} AS NUMERIC)`, maxCost))
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.parts)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort field
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const parts = await db.query.parts.findMany({
    where: whereClause,
    with: {
      category: true,
    },
    orderBy: (parts) => [sortFn(parts[sortField as keyof typeof parts])],
    limit,
    offset,
  })

  return {
    data: parts,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + parts.length < total,
    },
  }
})
