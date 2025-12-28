import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * Validation schema for a single asset row
 */
const assetRowSchema = z.object({
  assetNumber: z.string().min(1).max(50),
  vin: z.string().max(17).nullable(),
  make: z.string().max(100).nullable(),
  model: z.string().max(100).nullable(),
  year: z.coerce.number().int().min(1900).max(2100).nullable(),
  licensePlate: z.string().max(20).nullable(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).default('active'),
  category: z.string().nullable(),
  mileage: z.coerce.number().min(0).default(0),
  operationalHours: z.coerce.number().min(0).default(0),
  description: z.string().nullable(),
})

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/)
  const rows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    if (!rawLine) continue
    const line = rawLine.trim()
    if (!line) continue

    const cells: string[] = []
    let currentCell = ''
    let insideQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      const nextChar = line[j + 1]

      if (char === '"' && insideQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"'
        j++ // Skip next quote
      } else if (char === '"') {
        // Toggle quote state
        insideQuotes = !insideQuotes
      } else if (char === ',' && !insideQuotes) {
        // End of cell
        cells.push(currentCell.trim())
        currentCell = ''
      } else {
        currentCell += char
      }
    }

    // Add last cell
    cells.push(currentCell.trim())
    rows.push(cells)
  }

  return rows
}

/**
 * Import assets from CSV
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'assets:write')

  const body = await readBody<{ csv: string }>(event)

  if (!body.csv || typeof body.csv !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV content is required',
    })
  }

  // Parse CSV
  const rows = parseCSV(body.csv)

  if (rows.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV file is empty',
    })
  }

  // Validate headers
  const headers = rows[0]
  if (!headers) {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV file is missing headers',
    })
  }

  const expectedHeaders = [
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
  ]

  const headerMismatch = expectedHeaders.filter((h) => !headers.includes(h))
  if (headerMismatch.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required columns: ${headerMismatch.join(', ')}`,
    })
  }

  // Fetch existing asset numbers to prevent duplicates
  const existingAssets = await db
    .select({ assetNumber: schema.assets.assetNumber })
    .from(schema.assets)
    .where(eq(schema.assets.organisationId, user.organisationId))

  const existingAssetNumbers = new Set(existingAssets.map((a) => a.assetNumber))

  // Fetch categories
  const categories = await db
    .select({ id: schema.assetCategories.id, name: schema.assetCategories.name })
    .from(schema.assetCategories)
    .where(eq(schema.assetCategories.organisationId, user.organisationId))

  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

  // Parse and validate data rows
  const dataRows = rows.slice(1) // Skip header row
  const assetsToCreate: Array<typeof schema.assets.$inferInsert> = []
  const errors: Array<{ row: number; message: string }> = []
  const skipped: string[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNumber = i + 2 // +2 because of 0-index and header row

    // Skip undefined or empty rows
    if (!row || row.every((cell) => !cell.trim())) continue

    // Map CSV columns to object
    const rowData = {
      assetNumber: row[0] ?? '',
      vin: row[1] ?? null,
      make: row[2] ?? null,
      model: row[3] ?? null,
      year: row[4] ?? null,
      licensePlate: row[5] ?? null,
      status: row[6] ?? 'active',
      category: row[7] ?? null,
      mileage: row[8] ?? '0',
      operationalHours: row[9] ?? '0',
      description: row[10] ?? null,
    }

    // Validate row
    const validationResult = assetRowSchema.safeParse(rowData)

    if (!validationResult.success) {
      errors.push({
        row: rowNumber,
        message: validationResult.error.issues.map((e) => e.message).join(', '),
      })
      continue
    }

    // Skip if asset number already exists
    if (existingAssetNumbers.has(validationResult.data.assetNumber)) {
      skipped.push(validationResult.data.assetNumber)
      continue
    }

    // Find category ID
    const categoryId = validationResult.data.category
      ? categoryMap.get(validationResult.data.category.toLowerCase()) || null
      : null

    assetsToCreate.push({
      organisationId: user.organisationId,
      assetNumber: validationResult.data.assetNumber,
      vin: validationResult.data.vin,
      make: validationResult.data.make,
      model: validationResult.data.model,
      year: validationResult.data.year,
      licensePlate: validationResult.data.licensePlate,
      status: validationResult.data.status,
      categoryId,
      mileage: validationResult.data.mileage.toString(),
      operationalHours: validationResult.data.operationalHours.toString(),
      description: validationResult.data.description,
    })
  }

  // Return errors if validation failed
  if (errors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation errors found',
      data: { errors },
    })
  }

  // Import assets
  let imported = 0
  if (assetsToCreate.length > 0) {
    const insertedAssets = await db.insert(schema.assets).values(assetsToCreate).returning()
    imported = insertedAssets.length

    // Log import in audit log
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'import',
      entityType: 'assets',
      newValues: {
        imported,
        skipped: skipped.length,
        assetNumbers: insertedAssets.map((a) => a.assetNumber),
      },
    })
  }

  return {
    success: true,
    imported,
    skipped: skipped.length,
    skippedAssetNumbers: skipped,
  }
})
