/**
 * Report Export API
 *
 * POST /api/reports/export
 *
 * Exports report data to various formats (CSV, XLSX, PDF)
 * Returns the file as a download stream with appropriate headers.
 *
 * Request body:
 * - format: 'csv' | 'xlsx' | 'pdf'
 * - title: string (report title for PDF/filename)
 * - columns: Array<{ field: string, label: string }> - column definitions
 * - data: Array<Record<string, unknown>> - the report data rows
 * - metadata?: { description?: string, generatedAt?: string, filters?: Record<string, string> }
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { requirePermission } from '../../utils/permissions'

const columnSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
})

const metadataSchema = z
  .object({
    description: z.string().optional(),
    generatedAt: z.string().optional(),
    filters: z.record(z.string(), z.string()).optional(),
  })
  .optional()

const exportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf']),
  title: z.string().min(1).max(200),
  columns: z.array(columnSchema).min(1).max(50),
  data: z.array(z.record(z.string(), z.unknown())).max(10000),
  metadata: metadataSchema,
})

type ExportColumn = z.infer<typeof columnSchema>
type ExportRequest = z.infer<typeof exportRequestSchema>

/**
 * Escape a value for CSV output
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    // Format numbers with up to 2 decimal places if needed
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Generate CSV content from report data
 */
function generateCSV(columns: ExportColumn[], data: Record<string, unknown>[]): string {
  // Header row
  const headers = columns.map((c) => escapeCSV(c.label))
  const rows: string[] = [headers.join(',')]

  // Data rows
  for (const row of data) {
    const values = columns.map((col) => {
      const value = row[col.field]
      return escapeCSV(formatValue(value))
    })
    rows.push(values.join(','))
  }

  return rows.join('\n')
}

/**
 * Generate XLSX workbook from report data
 */
function generateXLSX(
  title: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  metadata?: ExportRequest['metadata'],
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // Prepare header row
  const headers = columns.map((c) => c.label)

  // Prepare data rows
  const rows = data.map((row) => columns.map((col) => formatValue(row[col.field])))

  // Create worksheet data with headers
  const worksheetData = [headers, ...rows]

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Set column widths based on content
  const colWidths = columns.map((col, idx) => {
    const headerLen = col.label.length
    const maxDataLen = rows.reduce((max, row) => {
      const cellValue = String(row[idx] || '')
      return Math.max(max, cellValue.length)
    }, 0)
    return { wch: Math.min(Math.max(headerLen, maxDataLen, 10), 50) }
  })
  worksheet['!cols'] = colWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')

  // Add metadata sheet if provided
  if (metadata) {
    const metadataRows: string[][] = []
    metadataRows.push(['Report Information'])
    metadataRows.push(['Title', title])
    if (metadata.description) {
      metadataRows.push(['Description', metadata.description])
    }
    metadataRows.push(['Generated At', metadata.generatedAt || new Date().toISOString()])
    metadataRows.push(['Total Rows', String(data.length)])

    if (metadata.filters && Object.keys(metadata.filters).length > 0) {
      metadataRows.push([])
      metadataRows.push(['Applied Filters'])
      for (const [key, value] of Object.entries(metadata.filters)) {
        metadataRows.push([key, value])
      }
    }

    const metaSheet = XLSX.utils.aoa_to_sheet(metadataRows)
    metaSheet['!cols'] = [{ wch: 20 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Info')
  }

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * Generate PDF document from report data
 */
function generatePDF(
  title: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  metadata?: ExportRequest['metadata'],
): ArrayBuffer {
  // Create PDF in landscape for wider tables
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Add title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 15)

  // Add metadata if provided
  let startY = 25
  if (metadata) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)

    if (metadata.description) {
      doc.text(metadata.description, 14, startY)
      startY += 6
    }

    const generatedAt = metadata.generatedAt || new Date().toISOString()
    doc.text(`Generated: ${new Date(generatedAt).toLocaleString()}`, 14, startY)
    startY += 6

    doc.text(`Total rows: ${data.length}`, 14, startY)
    startY += 6

    if (metadata.filters && Object.keys(metadata.filters).length > 0) {
      const filterStr = Object.entries(metadata.filters)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      doc.text(`Filters: ${filterStr}`, 14, startY)
      startY += 6
    }
  }

  // Reset text color
  doc.setTextColor(0)

  // Prepare table data
  const tableHeaders = columns.map((c) => c.label)
  const tableData = data.map((row) => columns.map((col) => formatValue(row[col.field])))

  // Add table using autoTable
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: startY + 2,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    tableWidth: 'auto',
    columnStyles: columns.reduce(
      (acc, _, idx) => {
        acc[idx] = { cellWidth: 'auto' }
        return acc
      },
      {} as Record<number, { cellWidth: 'auto' }>,
    ),
  })

  // Add page numbers
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

  // Return as ArrayBuffer
  return doc.output('arraybuffer')
}

/**
 * Generate a safe filename from the title
 */
function generateFilename(title: string, format: string): string {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  const date = new Date().toISOString().split('T')[0]
  return `${safeTitle}-${date}.${format}`
}

export default defineEventHandler(async (event) => {
  // Require reports:read permission
  await requirePermission(event, 'reports:read')

  const body = await readBody(event)
  const result = exportRequestSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { format, title, columns, data, metadata } = result.data

  let content: string | ArrayBuffer
  let contentType: string
  let extension: string

  switch (format) {
    case 'csv':
      content = generateCSV(columns, data)
      contentType = 'text/csv; charset=utf-8'
      extension = 'csv'
      break

    case 'xlsx':
      content = generateXLSX(title, columns, data, metadata)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      extension = 'xlsx'
      break

    case 'pdf':
      content = generatePDF(title, columns, data, metadata)
      contentType = 'application/pdf'
      extension = 'pdf'
      break

    default:
      throw createError({
        statusCode: 400,
        statusMessage: `Unsupported format: ${format}`,
      })
  }

  const filename = generateFilename(title, extension)

  // Set response headers for file download
  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-cache',
  })

  // Return content (Buffer for binary formats, string for CSV)
  if (typeof content === 'string') {
    return content
  }

  return Buffer.from(content)
})
