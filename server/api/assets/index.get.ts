import { db, schema } from '../../utils/db'
import { eq, and, ilike, or, gte, lte, sql, asc, desc } from 'drizzle-orm'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)

  // Basic filters
  const search = query.search as string | undefined
  const status = query.status as string | undefined
  const categoryId = query.categoryId as string | undefined
  const includeArchived = query.includeArchived === 'true'

  // Advanced filters
  const make = query.make as string | undefined
  const model = query.model as string | undefined
  const yearMin = query.yearMin ? parseInt(query.yearMin as string) : undefined
  const yearMax = query.yearMax ? parseInt(query.yearMax as string) : undefined
  const mileageMin = query.mileageMin ? parseFloat(query.mileageMin as string) : undefined
  const mileageMax = query.mileageMax ? parseFloat(query.mileageMax as string) : undefined
  const hoursMin = query.hoursMin ? parseFloat(query.hoursMin as string) : undefined
  const hoursMax = query.hoursMax ? parseFloat(query.hoursMax as string) : undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = [
    'assetNumber',
    'make',
    'model',
    'year',
    'status',
    'mileage',
    'operationalHours',
    'createdAt',
    'updatedAt'
  ]

  const conditions = [eq(schema.assets.organisationId, session.user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.assets.isArchived, false))
  }

  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(
      eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed')
    )
  }

  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

  // Global search across multiple fields
  if (search) {
    conditions.push(
      or(
        ilike(schema.assets.assetNumber, `%${search}%`),
        ilike(schema.assets.vin, `%${search}%`),
        ilike(schema.assets.make, `%${search}%`),
        ilike(schema.assets.model, `%${search}%`),
        ilike(schema.assets.licensePlate, `%${search}%`),
        ilike(schema.assets.description, `%${search}%`)
      )!
    )
  }

  // Advanced filters
  if (make) {
    conditions.push(ilike(schema.assets.make, `%${make}%`))
  }

  if (model) {
    conditions.push(ilike(schema.assets.model, `%${model}%`))
  }

  if (yearMin && !isNaN(yearMin)) {
    conditions.push(gte(schema.assets.year, yearMin))
  }

  if (yearMax && !isNaN(yearMax)) {
    conditions.push(lte(schema.assets.year, yearMax))
  }

  if (mileageMin && !isNaN(mileageMin)) {
    conditions.push(gte(sql`CAST(${schema.assets.mileage} AS NUMERIC)`, mileageMin))
  }

  if (mileageMax && !isNaN(mileageMax)) {
    conditions.push(lte(sql`CAST(${schema.assets.mileage} AS NUMERIC)`, mileageMax))
  }

  if (hoursMin && !isNaN(hoursMin)) {
    conditions.push(gte(sql`CAST(${schema.assets.operationalHours} AS NUMERIC)`, hoursMin))
  }

  if (hoursMax && !isNaN(hoursMax)) {
    conditions.push(lte(sql`CAST(${schema.assets.operationalHours} AS NUMERIC)`, hoursMax))
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assets)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort field
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const assets = await db.query.assets.findMany({
    where: whereClause,
    with: {
      category: true
    },
    orderBy: assets => [sortFn(assets[sortField as keyof typeof assets])],
    limit,
    offset
  })

  return {
    data: assets,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + assets.length < total
    }
  }
})
