/**
 * Excel Export Utility
 *
 * Provides functions for generating Excel workbooks using the xlsx (SheetJS) library.
 * Supports creating sheets with headers, data, styling, and metadata.
 * Returns buffers suitable for streaming to clients.
 */

import * as XLSX from 'xlsx'

/**
 * Column configuration for Excel export
 */
export interface ExcelColumn {
  /** Field key to extract value from data row */
  field: string
  /** Header label displayed in the sheet */
  label: string
  /** Column width in characters (default: auto-calculated) */
  width?: number
  /** Data type hint for formatting */
  type?: 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'percent'
}

/**
 * Sheet configuration for multi-sheet workbooks
 */
export interface SheetConfig {
  /** Sheet name (max 31 characters) */
  name: string
  /** Column definitions */
  columns: ExcelColumn[]
  /** Data rows */
  data: Record<string, unknown>[]
  /** Whether to freeze the header row */
  freezeHeader?: boolean
}

/**
 * Metadata for the report info sheet
 */
export interface ReportMetadata {
  /** Report title */
  title: string
  /** Report description */
  description?: string
  /** Generation timestamp */
  generatedAt?: Date | string
  /** User who generated the report */
  generatedBy?: string
  /** Applied filters */
  filters?: Record<string, string | number | boolean>
  /** Additional custom metadata fields */
  custom?: Record<string, string | number | boolean>
}

/**
 * Options for creating an Excel workbook
 */
export interface ExcelWorkbookOptions {
  /** Sheets to include in the workbook */
  sheets: SheetConfig[]
  /** Optional metadata sheet (will be added as first sheet named "Info") */
  metadata?: ReportMetadata
  /** Date format for date columns (default: 'yyyy-mm-dd') */
  dateFormat?: string
  /** Whether to apply default styling (bold headers, auto-width) */
  applyDefaultStyles?: boolean
}

/**
 * Options for creating a simple single-sheet workbook
 */
export interface SimpleExcelOptions {
  /** Sheet name */
  sheetName?: string
  /** Column definitions */
  columns: ExcelColumn[]
  /** Data rows */
  data: Record<string, unknown>[]
  /** Optional metadata for info sheet */
  metadata?: ReportMetadata
  /** Whether to apply default styling */
  applyDefaultStyles?: boolean
}

/**
 * Format a value for Excel output based on column type
 */
function formatCellValue(
  value: unknown,
  type?: ExcelColumn['type'],
): string | number | boolean | null | Date {
  if (value === null || value === undefined) {
    return null
  }

  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
      if (typeof value === 'number') {
        return value
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed) ? value : parsed
      }
      return String(value)

    case 'date':
      if (value instanceof Date) {
        return value
      }
      if (typeof value === 'string') {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? value : date
      }
      return String(value)

    case 'boolean':
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
      }
      return String(value)

    default:
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }
      return String(value)
  }
}

/**
 * Calculate auto-width for columns based on content
 */
function calculateColumnWidths(
  columns: ExcelColumn[],
  data: Record<string, unknown>[],
): { wch: number }[] {
  return columns.map((col) => {
    // If explicit width provided, use it
    if (col.width) {
      return { wch: col.width }
    }

    // Calculate width from header and data
    const headerLength = col.label.length
    let maxDataLength = 0

    for (const row of data) {
      const value = row[col.field]
      const cellValue = formatCellValue(value, col.type)
      const cellLength = cellValue !== null ? String(cellValue).length : 0
      maxDataLength = Math.max(maxDataLength, cellLength)
    }

    // Add padding and cap the width
    const calculatedWidth = Math.max(headerLength, maxDataLength) + 2
    return { wch: Math.min(Math.max(calculatedWidth, 8), 60) }
  })
}

/**
 * Create a worksheet from column definitions and data
 */
function createDataSheet(
  columns: ExcelColumn[],
  data: Record<string, unknown>[],
  applyStyles = true,
): XLSX.WorkSheet {
  // Prepare header row
  const headers = columns.map((c) => c.label)

  // Prepare data rows with proper value formatting
  const rows = data.map((row) => columns.map((col) => formatCellValue(row[col.field], col.type)))

  // Combine headers and data
  const sheetData = [headers, ...rows]

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)

  // Apply column widths
  if (applyStyles) {
    worksheet['!cols'] = calculateColumnWidths(columns, data)
  }

  return worksheet
}

/**
 * Create a metadata/info sheet with report information
 */
function createMetadataSheet(metadata: ReportMetadata, dataRowCount: number): XLSX.WorkSheet {
  const rows: (string | number | boolean | null)[][] = []

  // Report Information header
  rows.push(['Report Information'])
  rows.push([])

  // Title
  rows.push(['Title', metadata.title])

  // Description
  if (metadata.description) {
    rows.push(['Description', metadata.description])
  }

  // Generation info
  const generatedAt = metadata.generatedAt
    ? typeof metadata.generatedAt === 'string'
      ? metadata.generatedAt
      : metadata.generatedAt.toISOString()
    : new Date().toISOString()
  rows.push(['Generated At', generatedAt])

  if (metadata.generatedBy) {
    rows.push(['Generated By', metadata.generatedBy])
  }

  // Row count
  rows.push(['Total Rows', dataRowCount])
  rows.push([])

  // Applied filters section
  if (metadata.filters && Object.keys(metadata.filters).length > 0) {
    rows.push(['Applied Filters'])
    for (const [key, value] of Object.entries(metadata.filters)) {
      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value
      rows.push([key, displayValue])
    }
    rows.push([])
  }

  // Custom metadata section
  if (metadata.custom && Object.keys(metadata.custom).length > 0) {
    rows.push(['Additional Information'])
    for (const [key, value] of Object.entries(metadata.custom)) {
      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value
      rows.push([key, displayValue])
    }
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths for metadata sheet
  worksheet['!cols'] = [{ wch: 25 }, { wch: 60 }]

  return worksheet
}

/**
 * Create a simple Excel workbook with a single data sheet
 *
 * @param options - Configuration for the workbook
 * @returns Buffer containing the Excel file
 *
 * @example
 * ```typescript
 * const buffer = createExcelWorkbook({
 *   sheetName: 'Assets',
 *   columns: [
 *     { field: 'assetNumber', label: 'Asset Number', type: 'string' },
 *     { field: 'cost', label: 'Cost', type: 'currency' },
 *   ],
 *   data: [
 *     { assetNumber: 'A-001', cost: 15000 },
 *     { assetNumber: 'A-002', cost: 22000 },
 *   ],
 *   metadata: {
 *     title: 'Asset Report',
 *     description: 'Monthly asset inventory',
 *   },
 * })
 * ```
 */
export function createExcelWorkbook(options: SimpleExcelOptions): Buffer {
  const { sheetName = 'Data', columns, data, metadata, applyDefaultStyles = true } = options

  const workbook = XLSX.utils.book_new()

  // Add metadata sheet first if provided
  if (metadata) {
    const metaSheet = createMetadataSheet(metadata, data.length)
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Info')
  }

  // Add data sheet
  const dataSheet = createDataSheet(columns, data, applyDefaultStyles)
  XLSX.utils.book_append_sheet(workbook, dataSheet, sanitizeSheetName(sheetName))

  // Generate buffer
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return Buffer.from(arrayBuffer)
}

/**
 * Create a multi-sheet Excel workbook
 *
 * @param options - Configuration for the workbook including multiple sheets
 * @returns Buffer containing the Excel file
 *
 * @example
 * ```typescript
 * const buffer = createMultiSheetWorkbook({
 *   sheets: [
 *     {
 *       name: 'Assets',
 *       columns: [{ field: 'name', label: 'Name' }],
 *       data: [{ name: 'Truck 1' }],
 *     },
 *     {
 *       name: 'Work Orders',
 *       columns: [{ field: 'title', label: 'Title' }],
 *       data: [{ title: 'Oil Change' }],
 *     },
 *   ],
 *   metadata: {
 *     title: 'Fleet Report',
 *     generatedAt: new Date(),
 *   },
 * })
 * ```
 */
export function createMultiSheetWorkbook(options: ExcelWorkbookOptions): Buffer {
  const { sheets, metadata, applyDefaultStyles = true } = options

  const workbook = XLSX.utils.book_new()

  // Add metadata sheet first if provided
  if (metadata) {
    // Calculate total row count across all sheets
    const totalRows = sheets.reduce((sum, sheet) => sum + sheet.data.length, 0)
    const metaSheet = createMetadataSheet(metadata, totalRows)
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Info')
  }

  // Add data sheets
  for (const sheetConfig of sheets) {
    const worksheet = createDataSheet(sheetConfig.columns, sheetConfig.data, applyDefaultStyles)

    // Apply freeze pane for header row if requested
    if (sheetConfig.freezeHeader) {
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetConfig.name))
  }

  // Generate buffer
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return Buffer.from(arrayBuffer)
}

/**
 * Sanitize sheet name to comply with Excel requirements
 * - Max 31 characters
 * - Cannot contain: \ / * ? : [ ]
 * - Cannot be empty
 */
function sanitizeSheetName(name: string): string {
  if (!name) {
    return 'Sheet1'
  }

  // Remove invalid characters (Excel forbids: \ / * ? : [ ])
  let sanitized = name.replace(/[\\/*?:[\]]/g, '_')

  // Trim and truncate to 31 characters
  sanitized = sanitized.trim().slice(0, 31)

  // Ensure not empty after sanitization
  return sanitized || 'Sheet1'
}

/**
 * Create column definitions from a data sample
 *
 * Useful when you don't have predefined column definitions and want to
 * automatically generate them from the first data row.
 *
 * @param data - Array of data objects
 * @param options - Options for column generation
 * @returns Array of ExcelColumn definitions
 *
 * @example
 * ```typescript
 * const columns = createColumnsFromData(data, {
 *   excludeFields: ['id', 'organisationId'],
 *   labelMap: { createdAt: 'Created Date' },
 * })
 * ```
 */
export function createColumnsFromData(
  data: Record<string, unknown>[],
  options?: {
    /** Fields to exclude from column generation */
    excludeFields?: string[]
    /** Custom label mapping (field -> label) */
    labelMap?: Record<string, string>
    /** Type hints for specific fields */
    typeMap?: Record<string, ExcelColumn['type']>
  },
): ExcelColumn[] {
  if (!data.length) {
    return []
  }

  const firstRow = data[0] as Record<string, unknown>
  const excludeSet = new Set(options?.excludeFields || [])

  return Object.keys(firstRow)
    .filter((key) => !excludeSet.has(key))
    .map((key) => {
      // Convert camelCase to Title Case for default label
      const defaultLabel = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()

      // Infer type from first non-null value
      let inferredType: ExcelColumn['type'] = 'string'
      const sampleValue = firstRow[key]
      if (typeof sampleValue === 'number') {
        inferredType = 'number'
      } else if (typeof sampleValue === 'boolean') {
        inferredType = 'boolean'
      } else if (sampleValue instanceof Date) {
        inferredType = 'date'
      } else if (typeof sampleValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sampleValue)) {
        inferredType = 'date'
      }

      return {
        field: key,
        label: options?.labelMap?.[key] || defaultLabel,
        type: options?.typeMap?.[key] || inferredType,
      }
    })
}

/**
 * Get the MIME type for Excel files
 */
export const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Get the file extension for Excel files
 */
export const EXCEL_EXTENSION = 'xlsx'

/**
 * Generate a filename for an Excel export
 *
 * @param baseName - Base name for the file (will be sanitized)
 * @param includeDate - Whether to append the current date
 * @returns Sanitized filename with .xlsx extension
 */
export function generateExcelFilename(baseName: string, includeDate = true): string {
  // Sanitize the base name
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  if (includeDate) {
    const date = new Date().toISOString().split('T')[0]
    return `${sanitized}-${date}.${EXCEL_EXTENSION}`
  }

  return `${sanitized}.${EXCEL_EXTENSION}`
}
