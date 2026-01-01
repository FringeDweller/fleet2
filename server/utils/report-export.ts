/**
 * Unified Report Export Utility
 *
 * Provides a single interface for exporting reports in multiple formats (PDF, XLSX, CSV).
 * Wraps the existing pdf-export.ts and excel-export.ts utilities with a consistent API.
 */

import {
  createExcelWorkbook,
  EXCEL_EXTENSION,
  EXCEL_MIME_TYPE,
  type ExcelColumn,
  generateExcelFilename,
  type ReportMetadata,
} from './excel-export'
import {
  createPDFReport,
  generatePDFFilename,
  PDF_EXTENSION,
  PDF_MIME_TYPE,
  type PDFColumn,
  type PDFMetadata,
} from './pdf-export'

/**
 * Supported export formats
 */
export type ExportFormat = 'pdf' | 'xlsx' | 'csv'

/**
 * Column configuration for report export
 * Compatible with both PDF and Excel column definitions
 */
export interface ReportColumn {
  /** Field key to extract value from data row */
  key: string
  /** Header label displayed in the export */
  label: string
  /** Data type hint for formatting */
  format?: 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'percent'
  /** Column width (used for PDF/Excel) */
  width?: number
  /** Text alignment for PDF */
  align?: 'left' | 'center' | 'right'
}

/**
 * Metadata for the exported report
 */
export interface ExportMetadata {
  /** Report description */
  description?: string
  /** Generation timestamp */
  generatedAt?: Date | string
  /** User who generated the report */
  generatedBy?: string
  /** Applied filters displayed in the header */
  filters?: Record<string, string | number | boolean>
  /** Additional custom metadata fields */
  custom?: Record<string, string | number | boolean>
}

/**
 * Styling options for the exported report
 */
export interface ExportStyling {
  /** Page orientation for PDF (default: auto-selects based on column count) */
  orientation?: 'portrait' | 'landscape'
  /** Page format for PDF (default: 'a4') */
  pageFormat?: 'a4' | 'letter' | 'legal'
  /** Header background color as RGB array for PDF (default: [66, 66, 66]) */
  headerColor?: [number, number, number]
  /** Whether to include page numbers in PDF (default: true) */
  showPageNumbers?: boolean
  /** Font size for table content in PDF (default: 9) */
  fontSize?: number
  /** Whether to apply default styling in Excel (default: true) */
  applyDefaultStyles?: boolean
}

/**
 * Options for exporting a report
 */
export interface ExportReportOptions {
  /** Export format */
  format: ExportFormat
  /** Data rows to export */
  data: Record<string, unknown>[]
  /** Column definitions */
  columns: ReportColumn[]
  /** Report title */
  title: string
  /** Optional metadata for the report header */
  metadata?: ExportMetadata
  /** Optional styling options */
  styling?: ExportStyling
  /** Sheet name for Excel (default: 'Data') */
  sheetName?: string
  /** Whether to include date in filename (default: true) */
  includeDateInFilename?: boolean
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Buffer containing the exported file */
  buffer: Buffer
  /** MIME type for the Content-Type header */
  contentType: string
  /** Suggested filename with appropriate extension */
  filename: string
}

/**
 * CSV MIME type
 */
export const CSV_MIME_TYPE = 'text/csv'

/**
 * CSV file extension
 */
export const CSV_EXTENSION = 'csv'

/**
 * Convert ReportColumn to PDFColumn format
 */
function toPDFColumn(column: ReportColumn): PDFColumn {
  return {
    field: column.key,
    label: column.label,
    type: column.format,
    width: column.width,
    align: column.align,
  }
}

/**
 * Convert ReportColumn to ExcelColumn format
 */
function toExcelColumn(column: ReportColumn): ExcelColumn {
  return {
    field: column.key,
    label: column.label,
    type: column.format,
    width: column.width,
  }
}

/**
 * Convert ExportMetadata to PDFMetadata format
 */
function toPDFMetadata(metadata: ExportMetadata): PDFMetadata {
  return {
    description: metadata.description,
    generatedAt: metadata.generatedAt,
    generatedBy: metadata.generatedBy,
    filters: metadata.filters,
    custom: metadata.custom,
  }
}

/**
 * Convert ExportMetadata to ReportMetadata (Excel) format
 */
function toExcelMetadata(metadata: ExportMetadata, title: string): ReportMetadata {
  return {
    title,
    description: metadata.description,
    generatedAt: metadata.generatedAt,
    generatedBy: metadata.generatedBy,
    filters: metadata.filters,
    custom: metadata.custom,
  }
}

/**
 * Generate a sanitized filename with the appropriate extension
 */
function generateFilename(baseName: string, format: ExportFormat, includeDate = true): string {
  // Sanitize the base name
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  const extension =
    format === 'pdf' ? PDF_EXTENSION : format === 'xlsx' ? EXCEL_EXTENSION : CSV_EXTENSION

  if (includeDate) {
    const date = new Date().toISOString().split('T')[0]
    return `${sanitized}-${date}.${extension}`
  }

  return `${sanitized}.${extension}`
}

/**
 * Format a cell value for CSV output
 */
function formatCSVCellValue(value: unknown, format?: ReportColumn['format']): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (format) {
    case 'number':
      if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toFixed(2)
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed)
          ? value
          : Number.isInteger(parsed)
            ? String(parsed)
            : parsed.toFixed(2)
      }
      return String(value)

    case 'currency':
      if (typeof value === 'number') {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed)
          ? value
          : parsed.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      }
      return String(value)

    case 'percent':
      if (typeof value === 'number') {
        return `${(value * 100).toFixed(1)}%`
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed) ? value : `${(parsed * 100).toFixed(1)}%`
      }
      return String(value)

    case 'date':
      if (value instanceof Date) {
        return value.toISOString().split('T')[0] ?? ''
      }
      if (typeof value === 'string') {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? value : (date.toISOString().split('T')[0] ?? '')
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
 * Escape a value for CSV format (handle quotes and commas)
 */
function escapeCSVValue(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Create a CSV report from the provided data
 */
function createCSVReport(columns: ReportColumn[], data: Record<string, unknown>[]): Buffer {
  // Create header row
  const headerRow = columns.map((col) => escapeCSVValue(col.label)).join(',')

  // Create data rows
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSVValue(formatCSVCellValue(row[col.key], col.format))).join(','),
  )

  // Combine with newlines
  const csvContent = [headerRow, ...dataRows].join('\r\n')

  // Return as UTF-8 buffer with BOM for Excel compatibility
  const bom = Buffer.from([0xef, 0xbb, 0xbf])
  const content = Buffer.from(csvContent, 'utf-8')
  return Buffer.concat([bom, content])
}

/**
 * Export a report in the specified format
 *
 * Provides a unified interface for generating PDF, Excel, and CSV exports.
 *
 * @param options - Export configuration
 * @returns Export result containing buffer, content type, and filename
 *
 * @example
 * ```typescript
 * const result = await exportReport({
 *   format: 'pdf',
 *   title: 'Asset Report',
 *   columns: [
 *     { key: 'assetNumber', label: 'Asset Number', format: 'string' },
 *     { key: 'cost', label: 'Cost', format: 'currency' },
 *     { key: 'purchaseDate', label: 'Purchase Date', format: 'date' },
 *   ],
 *   data: [
 *     { assetNumber: 'A-001', cost: 15000, purchaseDate: '2024-01-15' },
 *     { assetNumber: 'A-002', cost: 22000, purchaseDate: '2024-02-20' },
 *   ],
 *   metadata: {
 *     description: 'Monthly asset inventory report',
 *     generatedBy: 'System Admin',
 *     filters: { status: 'active', department: 'Fleet' },
 *   },
 * })
 *
 * // Use the result
 * response.setHeader('Content-Type', result.contentType)
 * response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
 * response.send(result.buffer)
 * ```
 */
export async function exportReport(options: ExportReportOptions): Promise<ExportResult> {
  const {
    format,
    data,
    columns,
    title,
    metadata,
    styling,
    sheetName,
    includeDateInFilename = true,
  } = options

  const filename = generateFilename(title, format, includeDateInFilename)

  switch (format) {
    case 'pdf': {
      const pdfColumns = columns.map(toPDFColumn)
      const pdfMetadata = metadata ? toPDFMetadata(metadata) : undefined

      const buffer = createPDFReport({
        title,
        columns: pdfColumns,
        data,
        metadata: pdfMetadata,
        orientation: styling?.orientation,
        format: styling?.pageFormat,
        headerColor: styling?.headerColor,
        showPageNumbers: styling?.showPageNumbers ?? true,
        fontSize: styling?.fontSize,
      })

      return {
        buffer,
        contentType: PDF_MIME_TYPE,
        filename,
      }
    }

    case 'xlsx': {
      const excelColumns = columns.map(toExcelColumn)
      const excelMetadata = metadata ? toExcelMetadata(metadata, title) : undefined

      const buffer = createExcelWorkbook({
        sheetName: sheetName ?? 'Data',
        columns: excelColumns,
        data,
        metadata: excelMetadata,
        applyDefaultStyles: styling?.applyDefaultStyles ?? true,
      })

      return {
        buffer,
        contentType: EXCEL_MIME_TYPE,
        filename,
      }
    }

    case 'csv': {
      const buffer = createCSVReport(columns, data)

      return {
        buffer,
        contentType: CSV_MIME_TYPE,
        filename,
      }
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = format
      throw new Error(`Unsupported export format: ${_exhaustive}`)
    }
  }
}

/**
 * Get content type for a specific export format
 */
export function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'pdf':
      return PDF_MIME_TYPE
    case 'xlsx':
      return EXCEL_MIME_TYPE
    case 'csv':
      return CSV_MIME_TYPE
    default: {
      const _exhaustive: never = format
      throw new Error(`Unsupported export format: ${_exhaustive}`)
    }
  }
}

/**
 * Get file extension for a specific export format
 */
export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'pdf':
      return PDF_EXTENSION
    case 'xlsx':
      return EXCEL_EXTENSION
    case 'csv':
      return CSV_EXTENSION
    default: {
      const _exhaustive: never = format
      throw new Error(`Unsupported export format: ${_exhaustive}`)
    }
  }
}

/**
 * Create column definitions from a data sample
 *
 * Useful when you don't have predefined column definitions and want to
 * automatically generate them from the first data row.
 *
 * @param data - Array of data objects
 * @param options - Options for column generation
 * @returns Array of ReportColumn definitions
 *
 * @example
 * ```typescript
 * const columns = createColumnsFromData(data, {
 *   excludeFields: ['id', 'organisationId'],
 *   labelMap: { createdAt: 'Created Date' },
 *   formatMap: { cost: 'currency' },
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
    /** Format hints for specific fields */
    formatMap?: Record<string, ReportColumn['format']>
    /** Alignment hints for specific fields */
    alignMap?: Record<string, ReportColumn['align']>
  },
): ReportColumn[] {
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
      let inferredFormat: ReportColumn['format'] = 'string'
      const sampleValue = firstRow[key]
      if (typeof sampleValue === 'number') {
        inferredFormat = 'number'
      } else if (typeof sampleValue === 'boolean') {
        inferredFormat = 'boolean'
      } else if (sampleValue instanceof Date) {
        inferredFormat = 'date'
      } else if (typeof sampleValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sampleValue)) {
        inferredFormat = 'date'
      }

      // Determine final format (formatMap takes precedence)
      const finalFormat = options?.formatMap?.[key] || inferredFormat

      // Infer alignment based on type (numeric types align right)
      let inferredAlign: ReportColumn['align'] = 'left'
      if (finalFormat === 'number' || finalFormat === 'currency' || finalFormat === 'percent') {
        inferredAlign = 'right'
      }

      return {
        key,
        label: options?.labelMap?.[key] || defaultLabel,
        format: finalFormat,
        align: options?.alignMap?.[key] || inferredAlign,
      }
    })
}

/**
 * Validate that the export format is supported
 */
export function isValidExportFormat(format: string): format is ExportFormat {
  return format === 'pdf' || format === 'xlsx' || format === 'csv'
}

// Re-export types and constants from underlying modules for convenience
export {
  PDF_MIME_TYPE,
  PDF_EXTENSION,
  generatePDFFilename,
  EXCEL_MIME_TYPE,
  EXCEL_EXTENSION,
  generateExcelFilename,
}
