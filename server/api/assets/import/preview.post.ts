import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * Validation schema for a single asset row
 */
const assetRowSchema = z.object({
  assetNumber: z.string().min(1, 'Asset number is required').max(50),
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

interface ValidationError {
  row: number
  field: string
  message: string
  value?: unknown
}

interface PreviewRow {
  rowNumber: number
  data: {
    assetNumber: string
    vin: string | null
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    status: 'active' | 'inactive' | 'maintenance' | 'disposed'
    category: string | null
    mileage: number
    operationalHours: number
    description: string | null
  }
  errors: ValidationError[]
  warnings: string[]
}

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
 * Validate and preview CSV import
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

  // First row should be headers
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

  // Validate headers
  const headerMismatch = expectedHeaders.filter((h) => !headers.includes(h))
  if (headerMismatch.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required columns: ${headerMismatch.join(', ')}`,
    })
  }

  // Fetch existing asset numbers for duplicate detection
  const existingAssets = await db
    .select({ assetNumber: schema.assets.assetNumber })
    .from(schema.assets)
    .where(eq(schema.assets.organisationId, user.organisationId))

  const existingAssetNumbers = new Set(existingAssets.map((a) => a.assetNumber))

  // Fetch categories for validation
  const categories = await db
    .select({ id: schema.assetCategories.id, name: schema.assetCategories.name })
    .from(schema.assetCategories)
    .where(eq(schema.assetCategories.organisationId, user.organisationId))

  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

  // Parse and validate data rows
  const previewRows: PreviewRow[] = []
  const dataRows = rows.slice(1) // Skip header row

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

    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate row schema
    const validationResult = assetRowSchema.safeParse(rowData)

    if (!validationResult.success) {
      validationResult.error.issues.forEach((err) => {
        errors.push({
          row: rowNumber,
          field: err.path.join('.'),
          message: err.message,
          value: err.path.length > 0 ? rowData[err.path[0] as keyof typeof rowData] : undefined,
        })
      })
    }

    // Check for duplicate asset numbers within CSV
    const duplicateInCSV = previewRows.some(
      (p) => p.data.assetNumber.toLowerCase() === rowData.assetNumber.toLowerCase(),
    )
    if (duplicateInCSV) {
      errors.push({
        row: rowNumber,
        field: 'assetNumber',
        message: 'Duplicate asset number in CSV',
        value: rowData.assetNumber,
      })
    }

    // Check for existing asset numbers in database
    if (existingAssetNumbers.has(rowData.assetNumber)) {
      warnings.push(
        `Asset number "${rowData.assetNumber}" already exists and will be skipped on import`,
      )
    }

    // Validate category
    if (rowData.category && !categoryMap.has(rowData.category.toLowerCase())) {
      warnings.push(
        `Category "${rowData.category}" not found. Asset will be created without a category.`,
      )
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'maintenance', 'disposed']
    if (rowData.status && !validStatuses.includes(rowData.status.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: 'status',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        value: rowData.status,
      })
    }

    previewRows.push({
      rowNumber,
      data: validationResult.success
        ? validationResult.data
        : {
            assetNumber: rowData.assetNumber,
            vin: rowData.vin,
            make: rowData.make,
            model: rowData.model,
            year: null,
            licensePlate: rowData.licensePlate,
            status: 'active',
            category: rowData.category,
            mileage: 0,
            operationalHours: 0,
            description: rowData.description,
          },
      errors,
      warnings,
    })
  }

  const totalRows = previewRows.length
  const validRows = previewRows.filter((r) => r.errors.length === 0).length
  const errorRows = previewRows.filter((r) => r.errors.length > 0).length
  const warningRows = previewRows.filter(
    (r) => r.warnings.length > 0 && r.errors.length === 0,
  ).length

  return {
    summary: {
      totalRows,
      validRows,
      errorRows,
      warningRows,
      canImport: errorRows === 0 && validRows > 0,
    },
    rows: previewRows,
  }
})
