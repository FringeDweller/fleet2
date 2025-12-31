import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from './db'

/**
 * Supported import entity types
 */
export type ImportEntity = 'assets' | 'parts' | 'users'

/**
 * Validation error for a single field
 */
export interface ValidationError {
  row: number
  field: string
  message: string
  value?: unknown
}

/**
 * Preview row with validation status
 */
export interface PreviewRow {
  rowNumber: number
  data: Record<string, unknown>
  errors: ValidationError[]
  warnings: string[]
}

/**
 * Preview summary statistics
 */
export interface PreviewSummary {
  totalRows: number
  validRows: number
  errorRows: number
  warningRows: number
  canImport: boolean
}

/**
 * Full preview response
 */
export interface PreviewResponse {
  entity: ImportEntity
  summary: PreviewSummary
  rows: PreviewRow[]
}

/**
 * Import execution result
 */
export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  skippedIdentifiers: string[]
}

/**
 * Import report for download
 */
export interface ImportReport {
  timestamp: string
  entity: ImportEntity
  userId: string
  summary: {
    totalRows: number
    imported: number
    skipped: number
    errors: number
  }
  errors: Array<{ row: number; message: string }>
  skippedIdentifiers: string[]
}

/**
 * Entity template definitions
 */
export const ENTITY_TEMPLATES: Record<
  ImportEntity,
  {
    headers: string[]
    examples: string[][]
    description: string
  }
> = {
  assets: {
    headers: [
      'Asset Number',
      'Name',
      'Category',
      'Status',
      'Year',
      'Make',
      'Model',
      'VIN',
      'License Plate',
      'Mileage',
      'Operational Hours',
      'Description',
    ],
    examples: [
      [
        'FLT-0001',
        'Delivery Truck A',
        'Truck',
        'active',
        '2022',
        'Ford',
        'F-150',
        '1HGBH41JXMN109186',
        'ABC-123',
        '15000',
        '500',
        'Primary delivery truck',
      ],
      [
        'FLT-0002',
        'Sales Vehicle',
        'Sedan',
        'active',
        '2021',
        'Toyota',
        'Camry',
        '',
        'XYZ-789',
        '8500',
        '',
        'Sales team vehicle',
      ],
    ],
    description: 'Import fleet assets with their details',
  },
  parts: {
    headers: [
      'Part Number',
      'Name',
      'Category',
      'Current Quantity',
      'Minimum Quantity',
      'Unit',
      'Unit Cost',
      'Supplier',
      'Supplier Part Number',
      'Location',
      'Description',
    ],
    examples: [
      [
        'OIL-5W30',
        '5W-30 Motor Oil',
        'Fluids',
        '50',
        '10',
        'liters',
        '8.99',
        'AutoParts Inc',
        'AP-OIL-530',
        'Shelf A1',
        'Synthetic motor oil',
      ],
      [
        'FILTER-AIR-001',
        'Air Filter Universal',
        'Filters',
        '25',
        '5',
        'each',
        '12.50',
        'FilterCo',
        'FC-AF-001',
        'Shelf B2',
        'Standard air filter',
      ],
    ],
    description: 'Import inventory parts with stock levels',
  },
  users: {
    headers: ['Email', 'First Name', 'Last Name', 'Role', 'Phone'],
    examples: [
      ['john.doe@example.com', 'John', 'Doe', 'technician', '+1-555-0101'],
      ['jane.smith@example.com', 'Jane', 'Smith', 'operator', '+1-555-0102'],
    ],
    description: 'Import team members (password reset email will be sent)',
  },
}

/**
 * Validation schemas for each entity type
 */
const assetRowSchema = z.object({
  assetNumber: z.string().min(1, 'Asset number is required').max(50),
  name: z.string().max(200).optional().nullable(),
  category: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).default('active'),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  vin: z.string().max(17).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  mileage: z.coerce.number().min(0).default(0),
  operationalHours: z.coerce.number().min(0).default(0),
  description: z.string().optional().nullable(),
})

const partRowSchema = z.object({
  partNumber: z.string().min(1, 'Part number is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().optional().nullable(),
  currentQuantity: z.coerce.number().min(0).default(0),
  minimumQuantity: z.coerce.number().min(0).default(0),
  unit: z
    .enum(['each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair'])
    .default('each'),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  supplierPartNumber: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
})

const userRowSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z
    .enum(['admin', 'fleet_manager', 'supervisor', 'technician', 'operator'])
    .default('operator'),
  phone: z.string().max(50).optional().nullable(),
})

/**
 * Parse CSV content into rows with proper quote handling
 */
export function parseCSV(content: string): string[][] {
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
 * Escape a value for CSV output
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generate CSV template for an entity type
 */
export function generateTemplate(entity: ImportEntity): string {
  const template = ENTITY_TEMPLATES[entity]
  const headerRow = template.headers.join(',')
  const exampleRows = template.examples.map((row) => row.map(escapeCSV).join(','))
  return [headerRow, ...exampleRows].join('\n')
}

/**
 * Map CSV row to entity object based on entity type
 */
function mapRowToEntity(
  entity: ImportEntity,
  row: string[],
  headers: string[],
): Record<string, unknown> {
  const template = ENTITY_TEMPLATES[entity]
  const data: Record<string, unknown> = {}

  // Map header names to camelCase field names
  const headerMap: Record<string, string> = {
    'Asset Number': 'assetNumber',
    Name: 'name',
    Category: 'category',
    Status: 'status',
    Year: 'year',
    Make: 'make',
    Model: 'model',
    VIN: 'vin',
    'License Plate': 'licensePlate',
    Mileage: 'mileage',
    'Operational Hours': 'operationalHours',
    Description: 'description',
    'Part Number': 'partNumber',
    'Current Quantity': 'currentQuantity',
    'Minimum Quantity': 'minimumQuantity',
    Unit: 'unit',
    'Unit Cost': 'unitCost',
    Supplier: 'supplier',
    'Supplier Part Number': 'supplierPartNumber',
    Location: 'location',
    Email: 'email',
    'First Name': 'firstName',
    'Last Name': 'lastName',
    Role: 'role',
    Phone: 'phone',
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    if (!header) continue
    const fieldName = headerMap[header]
    if (fieldName) {
      const value = row[i]?.trim() || null
      // Convert empty strings to null
      data[fieldName] = value === '' ? null : value
    }
  }

  return data
}

/**
 * Get validation schema for entity type
 */
function getValidationSchema(entity: ImportEntity) {
  switch (entity) {
    case 'assets':
      return assetRowSchema
    case 'parts':
      return partRowSchema
    case 'users':
      return userRowSchema
    default:
      throw new Error(`Unknown entity type: ${entity}`)
  }
}

/**
 * Validate import data against schema and existing records
 */
export async function validateImportData(
  entity: ImportEntity,
  csvContent: string,
  organisationId: string,
): Promise<PreviewResponse> {
  // Parse CSV
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    throw new Error('CSV file is empty')
  }

  // Get headers from first row
  const headers = rows[0]
  if (!headers) {
    throw new Error('CSV file is missing headers')
  }

  // Validate headers match expected template
  const template = ENTITY_TEMPLATES[entity]
  const missingHeaders = template.headers.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
  }

  // Fetch existing identifiers for duplicate detection
  const existingIdentifiers = await getExistingIdentifiers(entity, organisationId)

  // Fetch reference data (categories, roles, etc.)
  const referenceData = await getReferenceData(entity, organisationId)

  // Get validation schema
  const validationSchema = getValidationSchema(entity)

  // Parse and validate data rows
  const previewRows: PreviewRow[] = []
  const dataRows = rows.slice(1) // Skip header row
  const seenIdentifiers = new Set<string>()

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNumber = i + 2 // +2 because of 0-index and header row

    // Skip undefined or empty rows
    if (!row || row.every((cell) => !cell?.trim())) continue

    // Map CSV columns to object
    const rowData = mapRowToEntity(entity, row, headers)

    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate against schema
    const validationResult = validationSchema.safeParse(rowData)

    if (!validationResult.success) {
      validationResult.error.issues.forEach((issue) => {
        errors.push({
          row: rowNumber,
          field: issue.path.join('.') || 'unknown',
          message: issue.message,
          value: issue.path.length > 0 ? rowData[issue.path[0] as string] : undefined,
        })
      })
    }

    // Get unique identifier for entity
    const identifier = getEntityIdentifier(entity, rowData)

    // Check for duplicates within CSV
    if (identifier && seenIdentifiers.has(identifier.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: getIdentifierField(entity),
        message: `Duplicate ${getIdentifierField(entity)} in CSV`,
        value: identifier,
      })
    }
    if (identifier) {
      seenIdentifiers.add(identifier.toLowerCase())
    }

    // Check for existing records in database
    if (identifier && existingIdentifiers.has(identifier.toLowerCase())) {
      warnings.push(
        `${getIdentifierLabel(entity)} "${identifier}" already exists and will be skipped on import`,
      )
    }

    // Validate reference data (categories, roles, etc.)
    validateReferenceData(entity, rowData, referenceData, warnings)

    previewRows.push({
      rowNumber,
      data: validationResult.success ? validationResult.data : rowData,
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
    entity,
    summary: {
      totalRows,
      validRows,
      errorRows,
      warningRows,
      canImport: errorRows === 0 && validRows > 0,
    },
    rows: previewRows,
  }
}

/**
 * Get existing identifiers for duplicate detection
 */
async function getExistingIdentifiers(
  entity: ImportEntity,
  organisationId: string,
): Promise<Set<string>> {
  switch (entity) {
    case 'assets': {
      const assets = await db
        .select({ assetNumber: schema.assets.assetNumber })
        .from(schema.assets)
        .where(eq(schema.assets.organisationId, organisationId))
      return new Set(assets.map((a) => a.assetNumber.toLowerCase()))
    }
    case 'parts': {
      const parts = await db
        .select({ sku: schema.parts.sku })
        .from(schema.parts)
        .where(eq(schema.parts.organisationId, organisationId))
      return new Set(parts.map((p) => p.sku.toLowerCase()))
    }
    case 'users': {
      const users = await db.select({ email: schema.users.email }).from(schema.users)
      return new Set(users.map((u) => u.email.toLowerCase()))
    }
    default:
      return new Set()
  }
}

/**
 * Get reference data (categories, roles) for validation
 */
async function getReferenceData(
  entity: ImportEntity,
  organisationId: string,
): Promise<Record<string, Map<string, string>>> {
  const data: Record<string, Map<string, string>> = {}

  switch (entity) {
    case 'assets': {
      const categories = await db
        .select({ id: schema.assetCategories.id, name: schema.assetCategories.name })
        .from(schema.assetCategories)
        .where(eq(schema.assetCategories.organisationId, organisationId))
      data.categories = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
      break
    }
    case 'parts': {
      const categories = await db
        .select({ id: schema.partCategories.id, name: schema.partCategories.name })
        .from(schema.partCategories)
        .where(eq(schema.partCategories.organisationId, organisationId))
      data.categories = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
      break
    }
    case 'users': {
      const roles = await db
        .select({ id: schema.roles.id, name: schema.roles.name })
        .from(schema.roles)
      data.roles = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]))
      break
    }
  }

  return data
}

/**
 * Validate reference data exists
 */
function validateReferenceData(
  entity: ImportEntity,
  rowData: Record<string, unknown>,
  referenceData: Record<string, Map<string, string>>,
  warnings: string[],
): void {
  switch (entity) {
    case 'assets':
    case 'parts': {
      const category = rowData.category as string | null
      if (
        category &&
        referenceData.categories &&
        !referenceData.categories.has(category.toLowerCase())
      ) {
        warnings.push(
          `Category "${category}" not found. Record will be created without a category.`,
        )
      }
      break
    }
    case 'users': {
      const role = rowData.role as string | null
      if (role && referenceData.roles && !referenceData.roles.has(role.toLowerCase())) {
        warnings.push(`Role "${role}" not found. User will be created with default role.`)
      }
      break
    }
  }
}

/**
 * Get unique identifier field name for entity
 */
function getIdentifierField(entity: ImportEntity): string {
  switch (entity) {
    case 'assets':
      return 'assetNumber'
    case 'parts':
      return 'partNumber'
    case 'users':
      return 'email'
    default:
      return 'id'
  }
}

/**
 * Get human-readable identifier label
 */
function getIdentifierLabel(entity: ImportEntity): string {
  switch (entity) {
    case 'assets':
      return 'Asset number'
    case 'parts':
      return 'Part number'
    case 'users':
      return 'Email'
    default:
      return 'Identifier'
  }
}

/**
 * Get unique identifier value from row data
 */
function getEntityIdentifier(
  entity: ImportEntity,
  rowData: Record<string, unknown>,
): string | null {
  const field = getIdentifierField(entity)
  const value = rowData[field]
  return typeof value === 'string' ? value : null
}

/**
 * Execute the import operation
 */
export async function executeImport(
  entity: ImportEntity,
  csvContent: string,
  organisationId: string,
  userId: string,
): Promise<ImportResult> {
  // Re-validate to ensure data is still valid
  const preview = await validateImportData(entity, csvContent, organisationId)

  if (!preview.summary.canImport) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: preview.rows
        .filter((r) => r.errors.length > 0)
        .map((r) => ({
          row: r.rowNumber,
          message: r.errors.map((e) => `${e.field}: ${e.message}`).join(', '),
        })),
      skippedIdentifiers: [],
    }
  }

  // Get existing identifiers
  const existingIdentifiers = await getExistingIdentifiers(entity, organisationId)
  const referenceData = await getReferenceData(entity, organisationId)

  // Filter valid rows that don't exist
  const rowsToImport = preview.rows.filter((r) => {
    if (r.errors.length > 0) return false
    const identifier = getEntityIdentifier(entity, r.data)
    return !identifier || !existingIdentifiers.has(identifier.toLowerCase())
  })

  const skippedIdentifiers = preview.rows
    .filter((r) => {
      const identifier = getEntityIdentifier(entity, r.data)
      return identifier && existingIdentifiers.has(identifier.toLowerCase())
    })
    .map((r) => getEntityIdentifier(entity, r.data) || '')

  // Execute import based on entity type
  let imported = 0
  const errors: Array<{ row: number; message: string }> = []

  try {
    switch (entity) {
      case 'assets':
        imported = await importAssets(rowsToImport, referenceData, organisationId)
        break
      case 'parts':
        imported = await importParts(rowsToImport, referenceData, organisationId)
        break
      case 'users':
        imported = await importUsers(rowsToImport, referenceData, organisationId)
        break
    }

    // Log import in audit log
    await db.insert(schema.auditLog).values({
      organisationId,
      userId,
      action: 'import',
      entityType: entity,
      newValues: {
        imported,
        skipped: skippedIdentifiers.length,
        entity,
      },
    })
  } catch (error) {
    errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Unknown error during import',
    })
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors,
      skippedIdentifiers: [],
    }
  }

  return {
    success: true,
    imported,
    skipped: skippedIdentifiers.length,
    errors,
    skippedIdentifiers,
  }
}

/**
 * Import assets from validated rows
 */
async function importAssets(
  rows: PreviewRow[],
  referenceData: Record<string, Map<string, string>>,
  organisationId: string,
): Promise<number> {
  if (rows.length === 0) return 0

  const assetsToCreate = rows.map((row) => {
    const data = row.data as z.infer<typeof assetRowSchema>
    const categoryId = data.category
      ? referenceData.categories?.get(data.category.toLowerCase()) || null
      : null

    return {
      organisationId,
      assetNumber: data.assetNumber,
      vin: data.vin || null,
      make: data.make || null,
      model: data.model || null,
      year: data.year || null,
      licensePlate: data.licensePlate || null,
      status: data.status,
      categoryId,
      mileage: data.mileage.toString(),
      operationalHours: data.operationalHours.toString(),
      description: data.description || null,
    }
  })

  const inserted = await db.insert(schema.assets).values(assetsToCreate).returning()
  return inserted.length
}

/**
 * Import parts from validated rows
 */
async function importParts(
  rows: PreviewRow[],
  referenceData: Record<string, Map<string, string>>,
  organisationId: string,
): Promise<number> {
  if (rows.length === 0) return 0

  const partsToCreate = rows.map((row) => {
    const data = row.data as z.infer<typeof partRowSchema>
    const categoryId = data.category
      ? referenceData.categories?.get(data.category.toLowerCase()) || null
      : null

    return {
      organisationId,
      sku: data.partNumber,
      name: data.name,
      categoryId,
      quantityInStock: data.currentQuantity.toString(),
      minimumStock: data.minimumQuantity.toString(),
      unit: data.unit,
      unitCost: data.unitCost?.toString() || null,
      supplier: data.supplier || null,
      supplierPartNumber: data.supplierPartNumber || null,
      location: data.location || null,
      description: data.description || null,
    }
  })

  const inserted = await db.insert(schema.parts).values(partsToCreate).returning()
  return inserted.length
}

/**
 * Import users from validated rows
 */
async function importUsers(
  rows: PreviewRow[],
  referenceData: Record<string, Map<string, string>>,
  organisationId: string,
): Promise<number> {
  if (rows.length === 0) return 0

  // Get default role (operator) if role not found
  const defaultRoleId = referenceData.roles?.get('operator') || null

  if (!defaultRoleId) {
    throw new Error('Default role not found. Please ensure roles are configured.')
  }

  const usersToCreate = rows.map((row) => {
    const data = row.data as z.infer<typeof userRowSchema>
    const roleId = data.role
      ? referenceData.roles?.get(data.role.toLowerCase()) || defaultRoleId
      : defaultRoleId

    // Generate a random temporary password (user will need to reset)
    const tempPassword = generateTemporaryPassword()

    return {
      organisationId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId,
      phone: data.phone || null,
      passwordHash: tempPassword, // This will be hashed by the system
      isActive: true,
      emailVerified: false,
    }
  })

  // Note: In production, you would hash passwords and send reset emails
  // For now, we create users with temporary passwords
  const inserted = await db.insert(schema.users).values(usersToCreate).returning()
  return inserted.length
}

/**
 * Generate a temporary password for new users
 */
function generateTemporaryPassword(): string {
  // In production, this should use proper password hashing
  // For now, generate a random string that will trigger password reset
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Generate an import report for download
 */
export function generateImportReport(
  result: ImportResult,
  entity: ImportEntity,
  userId: string,
): ImportReport {
  return {
    timestamp: new Date().toISOString(),
    entity,
    userId,
    summary: {
      totalRows: result.imported + result.skipped + result.errors.length,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.length,
    },
    errors: result.errors,
    skippedIdentifiers: result.skippedIdentifiers,
  }
}

/**
 * Convert import report to downloadable CSV
 */
export function reportToCSV(report: ImportReport): string {
  const lines: string[] = []

  // Header section
  lines.push('Import Report')
  lines.push(`Entity,${report.entity}`)
  lines.push(`Timestamp,${report.timestamp}`)
  lines.push('')

  // Summary section
  lines.push('Summary')
  lines.push(`Total Rows,${report.summary.totalRows}`)
  lines.push(`Imported,${report.summary.imported}`)
  lines.push(`Skipped,${report.summary.skipped}`)
  lines.push(`Errors,${report.summary.errors}`)
  lines.push('')

  // Errors section
  if (report.errors.length > 0) {
    lines.push('Errors')
    lines.push('Row,Message')
    for (const error of report.errors) {
      lines.push(`${error.row},${escapeCSV(error.message)}`)
    }
    lines.push('')
  }

  // Skipped section
  if (report.skippedIdentifiers.length > 0) {
    lines.push('Skipped (Already Exists)')
    lines.push('Identifier')
    for (const id of report.skippedIdentifiers) {
      lines.push(escapeCSV(id))
    }
  }

  return lines.join('\n')
}
