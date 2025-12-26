import { db, schema } from '../../utils/db'
import { eq, and, ilike, or, gte, lte, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
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

  const conditions = [eq(schema.assets.organisationId, session.user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.assets.isArchived, false))
  }

  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed'))
  }

  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

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

  const assets = await db.query.assets.findMany({
    where: and(...conditions),
    with: {
      category: true
    },
    orderBy: (assets, { asc }) => [asc(assets.assetNumber)]
  })

  // Generate CSV
  const headers = [
    'Asset Number',
    'VIN',
    'Make',
    'Model',
    'Year',
    'License Plate',
    'Status',
    'Category',
    'Mileage',
    'Operational Hours',
    'Description',
    'Created At'
  ]

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = assets.map(asset => [
    escapeCSV(asset.assetNumber),
    escapeCSV(asset.vin),
    escapeCSV(asset.make),
    escapeCSV(asset.model),
    escapeCSV(asset.year),
    escapeCSV(asset.licensePlate),
    escapeCSV(asset.status),
    escapeCSV(asset.category?.name),
    escapeCSV(asset.mileage),
    escapeCSV(asset.operationalHours),
    escapeCSV(asset.description),
    escapeCSV(asset.createdAt?.toISOString())
  ].join(','))

  const csv = [headers.join(','), ...rows].join('\n')

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'export',
    entityType: 'assets',
    newValues: { count: assets.length, filters: { search, status, categoryId, make, model } }
  })

  // Set response headers for CSV download
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="assets-export-${new Date().toISOString().split('T')[0]}.csv"`)

  return csv
})
