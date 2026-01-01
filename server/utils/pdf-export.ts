/**
 * PDF Export Utility
 *
 * Provides functions for generating PDF reports using jsPDF with autoTable.
 * Supports title, headers, table data, and metadata.
 * Returns buffers suitable for streaming to clients.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Column configuration for PDF export
 */
export interface PDFColumn {
  /** Field key to extract value from data row */
  field: string
  /** Header label displayed in the table */
  label: string
  /** Column width (relative weight, auto-calculated if not specified) */
  width?: number
  /** Text alignment within the column */
  align?: 'left' | 'center' | 'right'
  /** Data type hint for formatting */
  type?: 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'percent'
}

/**
 * Metadata for the PDF report header
 */
export interface PDFMetadata {
  /** Report description (displayed below title) */
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
 * Options for creating a PDF report
 */
export interface PDFReportOptions {
  /** Report title (displayed at the top) */
  title: string
  /** Column definitions */
  columns: PDFColumn[]
  /** Data rows */
  data: Record<string, unknown>[]
  /** Optional metadata for the header section */
  metadata?: PDFMetadata
  /** Page orientation (default: auto-selects based on column count) */
  orientation?: 'portrait' | 'landscape'
  /** Page format (default: 'a4') */
  format?: 'a4' | 'letter' | 'legal'
  /** Header background color as RGB array (default: [66, 66, 66]) */
  headerColor?: [number, number, number]
  /** Whether to include page numbers (default: true) */
  showPageNumbers?: boolean
  /** Font size for table content (default: 9) */
  fontSize?: number
  /** Font size for header row (default: 10) */
  headerFontSize?: number
}

/**
 * Options for creating a simple PDF table
 */
export interface SimplePDFOptions {
  /** Report title */
  title: string
  /** Column definitions */
  columns: PDFColumn[]
  /** Data rows */
  data: Record<string, unknown>[]
  /** Optional metadata */
  metadata?: PDFMetadata
}

/**
 * Format a value for PDF output based on column type
 */
function formatCellValue(value: unknown, type?: PDFColumn['type']): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (type) {
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
        return value.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      }
      if (typeof value === 'string') {
        const date = new Date(value)
        return Number.isNaN(date.getTime())
          ? value
          : date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
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
 * Format a date value for display in metadata
 */
function formatMetadataDate(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (value instanceof Date) {
    return value.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

/**
 * Add metadata section to the PDF document
 *
 * @returns The Y position after the metadata section
 */
function addMetadataSection(
  doc: jsPDF,
  metadata: PDFMetadata,
  dataRowCount: number,
  startY: number,
): number {
  let currentY = startY

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)

  // Description
  if (metadata.description) {
    doc.text(metadata.description, 14, currentY)
    currentY += 6
  }

  // Generation info
  const generatedAt = formatMetadataDate(metadata.generatedAt)
  doc.text(`Generated: ${generatedAt}`, 14, currentY)
  currentY += 5

  if (metadata.generatedBy) {
    doc.text(`By: ${metadata.generatedBy}`, 14, currentY)
    currentY += 5
  }

  // Row count
  doc.text(`Total rows: ${dataRowCount}`, 14, currentY)
  currentY += 5

  // Applied filters
  if (metadata.filters && Object.keys(metadata.filters).length > 0) {
    const filterParts = Object.entries(metadata.filters).map(([key, value]) => {
      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
      return `${key}: ${displayValue}`
    })
    const filterStr = filterParts.join(' | ')

    // Handle long filter strings by wrapping
    const maxWidth = doc.internal.pageSize.getWidth() - 28
    const lines = doc.splitTextToSize(`Filters: ${filterStr}`, maxWidth)
    doc.text(lines, 14, currentY)
    currentY += lines.length * 4 + 1
  }

  // Custom metadata
  if (metadata.custom && Object.keys(metadata.custom).length > 0) {
    for (const [key, value] of Object.entries(metadata.custom)) {
      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
      doc.text(`${key}: ${displayValue}`, 14, currentY)
      currentY += 5
    }
  }

  // Reset text color
  doc.setTextColor(0)

  return currentY
}

/**
 * Add page numbers to all pages of the document
 */
function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' },
    )
  }
}

/**
 * Create a PDF report with table data
 *
 * @param options - Configuration for the PDF report
 * @returns Buffer containing the PDF file
 *
 * @example
 * ```typescript
 * const buffer = createPDFReport({
 *   title: 'Asset Report',
 *   columns: [
 *     { field: 'assetNumber', label: 'Asset Number', type: 'string' },
 *     { field: 'cost', label: 'Cost', type: 'currency' },
 *     { field: 'purchaseDate', label: 'Purchase Date', type: 'date' },
 *   ],
 *   data: [
 *     { assetNumber: 'A-001', cost: 15000, purchaseDate: '2024-01-15' },
 *     { assetNumber: 'A-002', cost: 22000, purchaseDate: '2024-02-20' },
 *   ],
 *   metadata: {
 *     description: 'Monthly asset inventory report',
 *     generatedAt: new Date(),
 *     filters: { status: 'active', department: 'Fleet' },
 *   },
 * })
 * ```
 */
export function createPDFReport(options: PDFReportOptions): Buffer {
  const {
    title,
    columns,
    data,
    metadata,
    orientation,
    format = 'a4',
    headerColor = [66, 66, 66],
    showPageNumbers = true,
    fontSize = 9,
    headerFontSize = 10,
  } = options

  // Auto-select orientation based on column count if not specified
  const docOrientation = orientation ?? (columns.length > 6 ? 'landscape' : 'portrait')

  // Create PDF document
  const doc = new jsPDF({
    orientation: docOrientation,
    unit: 'mm',
    format,
  })

  // Add title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 15)

  // Calculate starting Y position for table
  let startY = 25

  // Add metadata section if provided
  if (metadata) {
    startY = addMetadataSection(doc, metadata, data.length, startY)
    startY += 3 // Add some spacing before the table
  }

  // Prepare table headers
  const tableHeaders = columns.map((c) => c.label)

  // Prepare table data with formatted values
  const tableData = data.map((row) =>
    columns.map((col) => formatCellValue(row[col.field], col.type)),
  )

  // Calculate column styles with alignment
  const columnStyles: Record<
    number,
    { halign?: 'left' | 'center' | 'right'; cellWidth?: number | 'auto' | 'wrap' }
  > = {}
  columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.align || 'left',
      cellWidth: col.width || 'auto',
    }
  })

  // Add table using autoTable
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: startY + 2,
    styles: {
      fontSize,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: headerColor,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: headerFontSize,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 15, right: 10, bottom: 20, left: 10 },
    tableWidth: 'auto',
    columnStyles,
  })

  // Add page numbers if requested
  if (showPageNumbers) {
    addPageNumbers(doc)
  }

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

/**
 * Create a simple PDF report with default options
 *
 * @param options - Basic configuration for the PDF report
 * @returns Buffer containing the PDF file
 *
 * @example
 * ```typescript
 * const buffer = createSimplePDFReport({
 *   title: 'Work Orders',
 *   columns: [
 *     { field: 'id', label: 'ID' },
 *     { field: 'title', label: 'Title' },
 *     { field: 'status', label: 'Status' },
 *   ],
 *   data: workOrders,
 * })
 * ```
 */
export function createSimplePDFReport(options: SimplePDFOptions): Buffer {
  return createPDFReport({
    ...options,
    showPageNumbers: true,
    headerColor: [66, 66, 66],
  })
}

/**
 * Create column definitions from a data sample
 *
 * Useful when you don't have predefined column definitions and want to
 * automatically generate them from the first data row.
 *
 * @param data - Array of data objects
 * @param options - Options for column generation
 * @returns Array of PDFColumn definitions
 *
 * @example
 * ```typescript
 * const columns = createPDFColumnsFromData(data, {
 *   excludeFields: ['id', 'organisationId'],
 *   labelMap: { createdAt: 'Created Date' },
 * })
 * ```
 */
export function createPDFColumnsFromData(
  data: Record<string, unknown>[],
  options?: {
    /** Fields to exclude from column generation */
    excludeFields?: string[]
    /** Custom label mapping (field -> label) */
    labelMap?: Record<string, string>
    /** Type hints for specific fields */
    typeMap?: Record<string, PDFColumn['type']>
    /** Alignment hints for specific fields */
    alignMap?: Record<string, PDFColumn['align']>
  },
): PDFColumn[] {
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
      let inferredType: PDFColumn['type'] = 'string'
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

      // Determine final type (typeMap takes precedence)
      const finalType = options?.typeMap?.[key] || inferredType

      // Infer alignment based on type (numeric types align right)
      let inferredAlign: PDFColumn['align'] = 'left'
      if (finalType === 'number' || finalType === 'currency' || finalType === 'percent') {
        inferredAlign = 'right'
      }

      return {
        field: key,
        label: options?.labelMap?.[key] || defaultLabel,
        type: finalType,
        align: options?.alignMap?.[key] || inferredAlign,
      }
    })
}

/**
 * Get the MIME type for PDF files
 */
export const PDF_MIME_TYPE = 'application/pdf'

/**
 * Get the file extension for PDF files
 */
export const PDF_EXTENSION = 'pdf'

/**
 * Generate a filename for a PDF export
 *
 * @param baseName - Base name for the file (will be sanitized)
 * @param includeDate - Whether to append the current date
 * @returns Sanitized filename with .pdf extension
 */
export function generatePDFFilename(baseName: string, includeDate = true): string {
  // Sanitize the base name
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  if (includeDate) {
    const date = new Date().toISOString().split('T')[0]
    return `${sanitized}-${date}.${PDF_EXTENSION}`
  }

  return `${sanitized}.${PDF_EXTENSION}`
}
