import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Basic filters
  const search = query.search as string | undefined
  const status = query.status as string | undefined
  const categoryId = query.categoryId as string | undefined
  const includeArchived = query.includeArchived === 'true'

  // Location filter
  const hasLocation = query.hasLocation as string | undefined

  // Advanced filters
  const make = query.make as string | undefined
  const model = query.model as string | undefined
  const yearMin = query.yearMin ? parseInt(query.yearMin as string, 10) : undefined
  const yearMax = query.yearMax ? parseInt(query.yearMax as string, 10) : undefined
  const mileageMin = query.mileageMin ? parseFloat(query.mileageMin as string) : undefined
  const mileageMax = query.mileageMax ? parseFloat(query.mileageMax as string) : undefined
  const hoursMin = query.hoursMin ? parseFloat(query.hoursMin as string) : undefined
  const hoursMax = query.hoursMax ? parseFloat(query.hoursMax as string) : undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

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
    'locationName',
    'lastLocationUpdate',
    'createdAt',
    'updatedAt',
  ]

  const conditions = [eq(schema.assets.organisationId, user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.assets.isArchived, false))
  }

  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(
      eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed'),
    )
  }

  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

  // Location filter
  if (hasLocation === 'true') {
    conditions.push(isNotNull(schema.assets.latitude))
    conditions.push(isNotNull(schema.assets.longitude))
  } else if (hasLocation === 'false') {
    conditions.push(or(isNull(schema.assets.latitude), isNull(schema.assets.longitude))!)
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
        ilike(schema.assets.description, `%${search}%`),
        ilike(schema.assets.locationName, `%${search}%`),
        ilike(schema.assets.locationAddress, `%${search}%`),
      )!,
    )
  }

  // Advanced filters
  if (make) {
    conditions.push(ilike(schema.assets.make, `%${make}%`))
  }

  if (model) {
    conditions.push(ilike(schema.assets.model, `%${model}%`))
  }

  if (yearMin && !Number.isNaN(yearMin)) {
    conditions.push(gte(schema.assets.year, yearMin))
  }

  if (yearMax && !Number.isNaN(yearMax)) {
    conditions.push(lte(schema.assets.year, yearMax))
  }

  if (mileageMin && !Number.isNaN(mileageMin)) {
    conditions.push(gte(sql`CAST(${schema.assets.mileage} AS NUMERIC)`, mileageMin))
  }

  if (mileageMax && !Number.isNaN(mileageMax)) {
    conditions.push(lte(sql`CAST(${schema.assets.mileage} AS NUMERIC)`, mileageMax))
  }

  if (hoursMin && !Number.isNaN(hoursMin)) {
    conditions.push(gte(sql`CAST(${schema.assets.operationalHours} AS NUMERIC)`, hoursMin))
  }

  if (hoursMax && !Number.isNaN(hoursMax)) {
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
      category: true,
    },
    orderBy: (assets) => [sortFn(assets[sortField as keyof typeof assets])],
    limit,
    offset,
  })

  return {
    data: assets,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + assets.length < total,
    },
  }
})
