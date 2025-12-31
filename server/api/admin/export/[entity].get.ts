/**
 * Export entity data endpoint (US-17.7)
 *
 * GET /api/admin/export/:entity - Export entity data with filters
 *
 * Query params:
 * - format: 'csv' | 'xlsx' (default: csv)
 * - columns: comma-separated list of column names to include
 * - filters: JSON-encoded array of filter objects
 * - sort: field name to sort by
 * - sortDir: 'asc' | 'desc' (default: asc)
 */

import { z } from 'zod'
import type { ExportColumnConfig, ExportFilterConfig } from '../../../db/schema/scheduled-exports'
import {
  type ExportEntityType,
  type ExportFormat,
  fetchDataForExport,
  generateExportContent,
  getExportableColumns,
} from '../../../utils/data-export'
import { db, schema } from '../../../utils/db'

const entityTypes = ['assets', 'work_orders', 'parts', 'inspections', 'fuel_transactions'] as const

const querySchema = z.object({
  format: z.enum(['csv', 'xlsx']).optional().default('csv'),
  columns: z.string().optional(),
  filters: z.string().optional(),
  sort: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const entity = getRouterParam(event, 'entity') as ExportEntityType

  // Validate entity type
  if (!entityTypes.includes(entity)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid entity type. Must be one of: ${entityTypes.join(', ')}`,
    })
  }

  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    })
  }

  const { format, columns: columnsParam, filters: filtersParam, sort, sortDir } = parsed.data

  // Get available columns for the entity
  const availableColumns = getExportableColumns(entity)

  // Parse columns selection - if not provided, use all columns
  let selectedColumns: ExportColumnConfig[]
  if (columnsParam) {
    const columnNames = columnsParam.split(',').map((c) => c.trim())
    selectedColumns = availableColumns
      .filter((c) => columnNames.includes(c.field))
      .map((c) => ({ field: c.field, label: c.label, enabled: true }))
  } else {
    selectedColumns = availableColumns.map((c) => ({
      field: c.field,
      label: c.label,
      enabled: true,
    }))
  }

  if (selectedColumns.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No valid columns selected for export',
    })
  }

  // Parse filters
  let filters: ExportFilterConfig[] = []
  if (filtersParam) {
    try {
      filters = JSON.parse(filtersParam)
      if (!Array.isArray(filters)) {
        throw new Error('Filters must be an array')
      }
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid filters format. Expected JSON array.',
      })
    }
  }

  // Fetch data
  const data = await fetchDataForExport(entity, session.user.organisationId, filters, sort, sortDir)

  // Generate export content
  const entityLabels: Record<ExportEntityType, string> = {
    assets: 'Assets',
    work_orders: 'Work Orders',
    parts: 'Parts',
    inspections: 'Inspections',
    fuel_transactions: 'Fuel Transactions',
  }

  const { content, mimeType, extension } = generateExportContent(
    data,
    selectedColumns,
    format as ExportFormat,
    entityLabels[entity],
  )

  // Log the export in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'export',
    entityType: entity,
    newValues: {
      format,
      columns: selectedColumns.map((c) => c.field),
      filters,
      recordCount: data.length,
    },
  })

  // Set response headers for download
  const filename = `${entity}-export-${new Date().toISOString().split('T')[0]}.${extension}`
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return content
})
