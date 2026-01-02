/**
 * Report Export Composable (US-14.8)
 *
 * Provides export functionality for reports in multiple formats:
 * - CSV: Simple comma-separated values
 * - Excel (XLSX): Full spreadsheet with formatting
 * - PDF: Formatted document with tables and optional charts
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  header: string
  width?: number
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date'
}

export interface ExportOptions {
  filename: string
  title?: string
  sheetName?: string
  columns?: ExportColumn[]
  dateRange?: { start: Date | null; end: Date | null }
  summary?: Record<string, string | number>
}

export function useReportExport() {
  const toast = useToast()
  const isExporting = ref(false)
  const exportProgress = ref<string | null>(null)

  /**
   * Trigger download of a file
   */
  function downloadFile(content: BlobPart, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Format a value for export based on column format
   */
  function formatValue(value: unknown, format?: ExportColumn['format']): string {
    if (value === null || value === undefined) return ''

    switch (format) {
      case 'currency':
        return typeof value === 'number'
          ? `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(value)
      case 'percent':
        return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value)
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('en-AU') : String(value)
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('en-AU')
        }
        if (typeof value === 'string') {
          const date = new Date(value)
          return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-AU')
        }
        return String(value)
      default:
        return String(value)
    }
  }

  /**
   * Get raw value for spreadsheet (numbers stay numbers)
   */
  function getRawValue(value: unknown, format?: ExportColumn['format']): string | number | null {
    if (value === null || value === undefined) return null

    switch (format) {
      case 'currency':
      case 'percent':
      case 'number':
        return typeof value === 'number' ? value : null
      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0] ?? value.toISOString()
        }
        return String(value)
      default:
        return String(value)
    }
  }

  /**
   * Export data to CSV format
   */
  function exportToCSV(data: object[], options: ExportOptions): boolean {
    try {
      if (!data.length) {
        toast.add({
          title: 'No Data',
          description: 'No data available to export',
          color: 'warning',
        })
        return false
      }

      isExporting.value = true
      exportProgress.value = 'Generating CSV...'

      const firstRow = data[0]
      const columns: ExportColumn[] =
        options.columns ||
        (firstRow ? Object.keys(firstRow).map((key) => ({ key, header: key })) : [])
      const headers = columns.map((col) => col.header)

      const rows = data.map((row) =>
        columns.map((col) => {
          const value = (row as Record<string, unknown>)[col.key]
          const formatted = formatValue(value, col.format)
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (typeof formatted === 'string' && /[",\n\r]/.test(formatted)) {
            return `"${formatted.replace(/"/g, '""')}"`
          }
          return formatted
        }),
      )

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

      const filename = `${options.filename}-${new Date().toISOString().split('T')[0]}.csv`
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')

      toast.add({
        title: 'Export Complete',
        description: `CSV file downloaded: ${filename}`,
        color: 'success',
      })

      return true
    } catch (error) {
      console.error('CSV export failed:', error)
      toast.add({
        title: 'Export Failed',
        description: 'Failed to generate CSV file',
        color: 'error',
      })
      return false
    } finally {
      isExporting.value = false
      exportProgress.value = null
    }
  }

  /**
   * Export data to Excel (XLSX) format
   */
  function exportToExcel(data: object[], options: ExportOptions): boolean {
    try {
      if (!data.length) {
        toast.add({
          title: 'No Data',
          description: 'No data available to export',
          color: 'warning',
        })
        return false
      }

      isExporting.value = true
      exportProgress.value = 'Generating Excel file...'

      const excelFirstRow = data[0]
      const columns: ExportColumn[] =
        options.columns ||
        (excelFirstRow ? Object.keys(excelFirstRow).map((key) => ({ key, header: key })) : [])

      // Create worksheet data with proper types
      const wsData: (string | number | null)[][] = []

      // Add title row if provided
      if (options.title) {
        wsData.push([options.title])
        wsData.push([]) // Empty row
      }

      // Add date range if provided
      if (options.dateRange?.start || options.dateRange?.end) {
        const startStr = options.dateRange.start?.toLocaleDateString('en-AU') || ''
        const endStr = options.dateRange.end?.toLocaleDateString('en-AU') || ''
        wsData.push([`Period: ${startStr} - ${endStr}`])
        wsData.push([])
      }

      // Add summary if provided
      if (options.summary) {
        for (const [label, value] of Object.entries(options.summary)) {
          wsData.push([label, typeof value === 'number' ? value : String(value)])
        }
        wsData.push([])
      }

      // Add headers
      wsData.push(columns.map((col) => col.header))

      // Add data rows
      for (const row of data) {
        wsData.push(
          columns.map((col) => getRawValue((row as Record<string, unknown>)[col.key], col.format)),
        )
      }

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(wsData)

      // Set column widths
      const colWidths = columns.map((col) => ({ wch: col.width || 15 }))
      worksheet['!cols'] = colWidths

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Report')

      // Generate file
      const filename = `${options.filename}-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, filename)

      toast.add({
        title: 'Export Complete',
        description: `Excel file downloaded: ${filename}`,
        color: 'success',
      })

      return true
    } catch (error) {
      console.error('Excel export failed:', error)
      toast.add({
        title: 'Export Failed',
        description: 'Failed to generate Excel file',
        color: 'error',
      })
      return false
    } finally {
      isExporting.value = false
      exportProgress.value = null
    }
  }

  /**
   * Export data to PDF format with tables
   */
  function exportToPDF(data: object[], options: ExportOptions): boolean {
    try {
      if (!data.length) {
        toast.add({
          title: 'No Data',
          description: 'No data available to export',
          color: 'warning',
        })
        return false
      }

      isExporting.value = true
      exportProgress.value = 'Generating PDF...'

      const pdfFirstRow = data[0]
      const columns: ExportColumn[] =
        options.columns ||
        (pdfFirstRow ? Object.keys(pdfFirstRow).map((key) => ({ key, header: key })) : [])

      // Create PDF document (A4 landscape for wider tables)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      let yPosition = 15

      // Add title
      if (options.title) {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text(options.title, pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 10
      }

      // Add date range
      if (options.dateRange?.start || options.dateRange?.end) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const startStr = options.dateRange.start?.toLocaleDateString('en-AU') || ''
        const endStr = options.dateRange.end?.toLocaleDateString('en-AU') || ''
        doc.text(`Period: ${startStr} - ${endStr}`, pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 8
      }

      // Add summary section
      if (options.summary) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Summary', 14, yPosition)
        yPosition += 6

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        for (const [label, value] of Object.entries(options.summary)) {
          doc.text(`${label}: ${value}`, 14, yPosition)
          yPosition += 5
        }
        yPosition += 5
      }

      // Prepare table data
      const tableHeaders = columns.map((col) => col.header)
      const tableBody = data.map((row) =>
        columns.map((col) => formatValue((row as Record<string, unknown>)[col.key], col.format)),
      )

      // Add table using autoTable
      autoTable(doc, {
        head: [tableHeaders],
        body: tableBody,
        startY: yPosition,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [59, 130, 246], // Blue
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: columns.reduce(
          (acc, col, index) => {
            if (col.format === 'currency' || col.format === 'number' || col.format === 'percent') {
              acc[index] = { halign: 'right' }
            }
            return acc
          },
          {} as Record<number, { halign: 'right' | 'left' | 'center' }>,
        ),
        margin: { top: 10, left: 14, right: 14 },
        didDrawPage: () => {
          // Add footer with page numbers
          const pageCount = doc.getNumberOfPages()
          const currentPage = doc.getCurrentPageInfo().pageNumber
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.text(
            `Page ${currentPage} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' },
          )

          // Add generation date
          doc.text(
            `Generated: ${new Date().toLocaleString('en-AU')}`,
            pageWidth - 14,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'right' },
          )
        },
      })

      // Save the PDF
      const filename = `${options.filename}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)

      toast.add({
        title: 'Export Complete',
        description: `PDF file downloaded: ${filename}`,
        color: 'success',
      })

      return true
    } catch (error) {
      console.error('PDF export failed:', error)
      toast.add({
        title: 'Export Failed',
        description: 'Failed to generate PDF file',
        color: 'error',
      })
      return false
    } finally {
      isExporting.value = false
      exportProgress.value = null
    }
  }

  return {
    isExporting: readonly(isExporting),
    exportProgress: readonly(exportProgress),
    exportToCSV,
    exportToExcel,
    exportToPDF,
    formatValue,
  }
}
