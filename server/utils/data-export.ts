/**
 * Data Export Utilities (US-17.7)
 *
 * Provides functions for exporting entity data to CSV and Excel formats.
 */

import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, lte, ne, type SQL } from 'drizzle-orm'
import type { ExportColumnConfig, ExportFilterConfig } from '../db/schema/scheduled-exports'
import { db, schema } from './db'

// Entity types that can be exported
export type ExportEntityType =
  | 'assets'
  | 'work_orders'
  | 'parts'
  | 'inspections'
  | 'fuel_transactions'

// Export format types
export type ExportFormat = 'csv' | 'xlsx'

/**
 * Column definition for an exportable entity
 */
export interface ExportColumnDefinition {
  field: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean'
  description?: string
}

/**
 * Get available columns for an entity type
 */
export function getExportableColumns(entity: ExportEntityType): ExportColumnDefinition[] {
  const columns: Record<ExportEntityType, ExportColumnDefinition[]> = {
    assets: [
      { field: 'assetNumber', label: 'Asset Number', type: 'string' },
      { field: 'vin', label: 'VIN', type: 'string' },
      { field: 'make', label: 'Make', type: 'string' },
      { field: 'model', label: 'Model', type: 'string' },
      { field: 'year', label: 'Year', type: 'number' },
      { field: 'licensePlate', label: 'License Plate', type: 'string' },
      { field: 'status', label: 'Status', type: 'string' },
      { field: 'category', label: 'Category', type: 'string', description: 'Category name' },
      { field: 'mileage', label: 'Mileage', type: 'number' },
      { field: 'operationalHours', label: 'Operational Hours', type: 'number' },
      { field: 'description', label: 'Description', type: 'string' },
      { field: 'locationName', label: 'Location', type: 'string' },
      { field: 'isArchived', label: 'Archived', type: 'boolean' },
      { field: 'createdAt', label: 'Created At', type: 'date' },
      { field: 'updatedAt', label: 'Updated At', type: 'date' },
    ],
    work_orders: [
      { field: 'workOrderNumber', label: 'Work Order #', type: 'string' },
      { field: 'title', label: 'Title', type: 'string' },
      { field: 'description', label: 'Description', type: 'string' },
      { field: 'priority', label: 'Priority', type: 'string' },
      { field: 'status', label: 'Status', type: 'string' },
      { field: 'assetNumber', label: 'Asset Number', type: 'string', description: 'Related asset' },
      { field: 'assetMake', label: 'Asset Make', type: 'string' },
      { field: 'assetModel', label: 'Asset Model', type: 'string' },
      { field: 'assignedTo', label: 'Assigned To', type: 'string', description: 'Technician name' },
      { field: 'createdBy', label: 'Created By', type: 'string' },
      { field: 'dueDate', label: 'Due Date', type: 'date' },
      { field: 'startedAt', label: 'Started At', type: 'date' },
      { field: 'completedAt', label: 'Completed At', type: 'date' },
      { field: 'estimatedDuration', label: 'Est. Duration (min)', type: 'number' },
      { field: 'actualDuration', label: 'Actual Duration (min)', type: 'number' },
      { field: 'laborCost', label: 'Labor Cost', type: 'number' },
      { field: 'partsCost', label: 'Parts Cost', type: 'number' },
      { field: 'totalCost', label: 'Total Cost', type: 'number' },
      { field: 'partsUsed', label: 'Parts Used', type: 'string', description: 'Summary of parts' },
      { field: 'notes', label: 'Notes', type: 'string' },
      { field: 'completionNotes', label: 'Completion Notes', type: 'string' },
      { field: 'createdAt', label: 'Created At', type: 'date' },
      { field: 'updatedAt', label: 'Updated At', type: 'date' },
    ],
    parts: [
      { field: 'sku', label: 'SKU', type: 'string' },
      { field: 'name', label: 'Name', type: 'string' },
      { field: 'description', label: 'Description', type: 'string' },
      { field: 'category', label: 'Category', type: 'string' },
      { field: 'unit', label: 'Unit', type: 'string' },
      { field: 'quantityInStock', label: 'Qty in Stock', type: 'number' },
      { field: 'minimumStock', label: 'Min Stock', type: 'number' },
      { field: 'reorderThreshold', label: 'Reorder Threshold', type: 'number' },
      { field: 'reorderQuantity', label: 'Reorder Qty', type: 'number' },
      { field: 'unitCost', label: 'Unit Cost', type: 'number' },
      { field: 'supplier', label: 'Supplier', type: 'string' },
      { field: 'supplierPartNumber', label: 'Supplier Part #', type: 'string' },
      { field: 'location', label: 'Location', type: 'string' },
      {
        field: 'locations',
        label: 'All Locations',
        type: 'string',
        description: 'Location breakdown',
      },
      { field: 'onOrderQuantity', label: 'On Order Qty', type: 'number' },
      { field: 'isActive', label: 'Active', type: 'boolean' },
      { field: 'createdAt', label: 'Created At', type: 'date' },
      { field: 'updatedAt', label: 'Updated At', type: 'date' },
    ],
    inspections: [
      { field: 'inspectionNumber', label: 'Inspection #', type: 'string' },
      { field: 'templateName', label: 'Template', type: 'string' },
      { field: 'assetNumber', label: 'Asset Number', type: 'string' },
      { field: 'assetMake', label: 'Asset Make', type: 'string' },
      { field: 'assetModel', label: 'Asset Model', type: 'string' },
      { field: 'operatorName', label: 'Operator', type: 'string' },
      { field: 'status', label: 'Status', type: 'string' },
      { field: 'overallResult', label: 'Overall Result', type: 'string' },
      { field: 'initiationMethod', label: 'Initiation Method', type: 'string' },
      { field: 'startedAt', label: 'Started At', type: 'date' },
      { field: 'completedAt', label: 'Completed At', type: 'date' },
      { field: 'locationName', label: 'Location', type: 'string' },
      { field: 'passCount', label: 'Pass Count', type: 'number', description: 'Items passed' },
      { field: 'failCount', label: 'Fail Count', type: 'number', description: 'Items failed' },
      { field: 'naCount', label: 'N/A Count', type: 'number' },
      { field: 'notes', label: 'Notes', type: 'string' },
      { field: 'syncStatus', label: 'Sync Status', type: 'string' },
      { field: 'createdAt', label: 'Created At', type: 'date' },
    ],
    fuel_transactions: [
      { field: 'transactionNumber', label: 'Transaction #', type: 'string' },
      { field: 'assetNumber', label: 'Asset Number', type: 'string' },
      { field: 'assetMake', label: 'Asset Make', type: 'string' },
      { field: 'assetModel', label: 'Asset Model', type: 'string' },
      { field: 'operatorName', label: 'Operator', type: 'string' },
      { field: 'quantity', label: 'Quantity (L)', type: 'number' },
      { field: 'unitCost', label: 'Unit Cost', type: 'number' },
      { field: 'totalCost', label: 'Total Cost', type: 'number' },
      { field: 'fuelType', label: 'Fuel Type', type: 'string' },
      { field: 'odometer', label: 'Odometer', type: 'number' },
      { field: 'engineHours', label: 'Engine Hours', type: 'number' },
      { field: 'vendor', label: 'Vendor', type: 'string' },
      { field: 'locationName', label: 'Location', type: 'string' },
      { field: 'transactionDate', label: 'Transaction Date', type: 'date' },
      { field: 'source', label: 'Source', type: 'string' },
      { field: 'hasDiscrepancy', label: 'Has Discrepancy', type: 'boolean' },
      { field: 'discrepancyType', label: 'Discrepancy Type', type: 'string' },
      { field: 'notes', label: 'Notes', type: 'string' },
      { field: 'createdAt', label: 'Created At', type: 'date' },
    ],
  }

  return columns[entity] || []
}

/**
 * Escape a value for CSV output
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a date value for export
 */
function formatDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toISOString()
}

/**
 * Generate CSV content from data
 */
export function generateCSV(
  data: Record<string, unknown>[],
  columns: ExportColumnConfig[],
): string {
  const enabledColumns = columns.filter((c) => c.enabled)

  // Header row
  const headers = enabledColumns.map((c) => escapeCSV(c.label))
  const rows: string[] = [headers.join(',')]

  // Data rows
  for (const row of data) {
    const values = enabledColumns.map((col) => {
      const value = row[col.field]
      if (value instanceof Date) {
        return escapeCSV(formatDate(value))
      }
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
      }
      return escapeCSV(value as string | number | null)
    })
    rows.push(values.join(','))
  }

  return rows.join('\n')
}

/**
 * Generate Excel-compatible XML (SpreadsheetML)
 *
 * This creates a simple Excel-readable XML format that doesn't require
 * external libraries. For more complex Excel features, consider using xlsx library.
 */
export function generateExcel(
  data: Record<string, unknown>[],
  columns: ExportColumnConfig[],
  sheetName = 'Export',
): string {
  const enabledColumns = columns.filter((c) => c.enabled)

  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>\n`

  // Header row
  xml += '      <Row>\n'
  for (const col of enabledColumns) {
    xml += `        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>\n`
  }
  xml += '      </Row>\n'

  // Data rows
  for (const row of data) {
    xml += '      <Row>\n'
    for (const col of enabledColumns) {
      const value = row[col.field]
      let cellType = 'String'
      let cellValue = ''
      let styleId = ''

      if (value === null || value === undefined) {
        cellValue = ''
      } else if (value instanceof Date) {
        cellType = 'DateTime'
        cellValue = value.toISOString()
        styleId = ' ss:StyleID="Date"'
      } else if (typeof value === 'number') {
        cellType = 'Number'
        cellValue = String(value)
      } else if (typeof value === 'boolean') {
        cellValue = value ? 'Yes' : 'No'
      } else {
        cellValue = escapeXml(String(value))
      }

      xml += `        <Cell${styleId}><Data ss:Type="${cellType}">${cellValue}</Data></Cell>\n`
    }
    xml += '      </Row>\n'
  }

  xml += `    </Table>
  </Worksheet>
</Workbook>`

  return xml
}

/**
 * Apply filters to a Drizzle query dynamically
 */
export function buildFilterConditions(
  entity: ExportEntityType,
  filters: ExportFilterConfig[],
  organisationId: string,
): SQL[] {
  const conditions: SQL[] = []

  // Get the schema table for the entity
  const tableMap = {
    assets: schema.assets,
    work_orders: schema.workOrders,
    parts: schema.parts,
    inspections: schema.inspections,
    fuel_transactions: schema.fuelTransactions,
  }

  const table = tableMap[entity]
  if (!table) return conditions

  // Add organisation filter
  conditions.push(
    eq(
      (table as { organisationId: typeof schema.assets.organisationId }).organisationId,
      organisationId,
    ),
  )

  // Process each filter
  for (const filter of filters) {
    const column = (table as unknown as Record<string, unknown>)[filter.field]
    if (!column) continue

    switch (filter.operator) {
      case 'eq':
        conditions.push(eq(column as any, filter.value as string))
        break
      case 'neq':
        conditions.push(ne(column as any, filter.value as string))
        break
      case 'gt':
        conditions.push(gt(column as any, filter.value as number))
        break
      case 'gte':
        conditions.push(gte(column as any, filter.value as number))
        break
      case 'lt':
        conditions.push(lt(column as any, filter.value as number))
        break
      case 'lte':
        conditions.push(lte(column as any, filter.value as number))
        break
      case 'like':
        conditions.push(ilike(column as any, `%${filter.value}%`))
        break
      case 'in':
        if (Array.isArray(filter.value)) {
          conditions.push(inArray(column as any, filter.value))
        }
        break
    }
  }

  return conditions
}

/**
 * Fetch and format asset data for export
 */
export async function fetchAssetsForExport(
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  const conditions = buildFilterConditions('assets', filters, organisationId)

  const assets = await db.query.assets.findMany({
    where: and(...conditions),
    with: {
      category: true,
    },
    orderBy: sortField
      ? sortDirection === 'asc'
        ? [asc((schema.assets as Record<string, any>)[sortField])]
        : [desc((schema.assets as Record<string, any>)[sortField])]
      : [asc(schema.assets.assetNumber)],
  })

  return assets.map((asset) => ({
    ...asset,
    category: asset.category?.name ?? '',
    mileage: asset.mileage ? Number(asset.mileage) : null,
    operationalHours: asset.operationalHours ? Number(asset.operationalHours) : null,
  }))
}

/**
 * Fetch and format work order data for export
 */
export async function fetchWorkOrdersForExport(
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  const conditions = buildFilterConditions('work_orders', filters, organisationId)

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      assignee: true,
      createdBy: true,
      parts: {
        with: {
          part: true,
        },
      },
    },
    orderBy: sortField
      ? sortDirection === 'asc'
        ? [asc((schema.workOrders as Record<string, any>)[sortField])]
        : [desc((schema.workOrders as Record<string, any>)[sortField])]
      : [desc(schema.workOrders.createdAt)],
  })

  return workOrders.map((wo) => ({
    ...wo,
    assetNumber: wo.asset?.assetNumber ?? '',
    assetMake: wo.asset?.make ?? '',
    assetModel: wo.asset?.model ?? '',
    assignedTo: wo.assignee ? `${wo.assignee.firstName} ${wo.assignee.lastName}` : '',
    createdBy: wo.createdBy ? `${wo.createdBy.firstName} ${wo.createdBy.lastName}` : '',
    laborCost: wo.laborCost ? Number(wo.laborCost) : null,
    partsCost: wo.partsCost ? Number(wo.partsCost) : null,
    totalCost: wo.totalCost ? Number(wo.totalCost) : null,
    partsUsed: wo.parts.map((p) => `${p.partName} x${p.quantity}`).join('; '),
  }))
}

/**
 * Fetch and format parts data for export
 */
export async function fetchPartsForExport(
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  const conditions = buildFilterConditions('parts', filters, organisationId)

  const parts = await db.query.parts.findMany({
    where: and(...conditions),
    with: {
      category: true,
    },
    orderBy: sortField
      ? sortDirection === 'asc'
        ? [asc((schema.parts as Record<string, any>)[sortField])]
        : [desc((schema.parts as Record<string, any>)[sortField])]
      : [asc(schema.parts.name)],
  })

  // Get location quantities for each part
  const partIds = parts.map((p) => p.id)
  const locationQuantities =
    partIds.length > 0
      ? await db.query.partLocationQuantities.findMany({
          where: and(
            eq(schema.partLocationQuantities.organisationId, organisationId),
            inArray(schema.partLocationQuantities.partId, partIds),
          ),
          with: {
            location: true,
          },
        })
      : []

  const locationsByPart = new Map<string, string[]>()
  for (const lq of locationQuantities) {
    const existing = locationsByPart.get(lq.partId) || []
    existing.push(`${lq.location?.name}: ${lq.quantity}`)
    locationsByPart.set(lq.partId, existing)
  }

  return parts.map((part) => ({
    ...part,
    category: part.category?.name ?? '',
    quantityInStock: part.quantityInStock ? Number(part.quantityInStock) : 0,
    minimumStock: part.minimumStock ? Number(part.minimumStock) : null,
    reorderThreshold: part.reorderThreshold ? Number(part.reorderThreshold) : null,
    reorderQuantity: part.reorderQuantity ? Number(part.reorderQuantity) : null,
    unitCost: part.unitCost ? Number(part.unitCost) : null,
    onOrderQuantity: part.onOrderQuantity ? Number(part.onOrderQuantity) : 0,
    locations: locationsByPart.get(part.id)?.join('; ') ?? '',
  }))
}

/**
 * Fetch and format inspection data for export
 */
export async function fetchInspectionsForExport(
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  const conditions = buildFilterConditions('inspections', filters, organisationId)

  const inspections = await db.query.inspections.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      template: true,
      operator: true,
      items: true,
    },
    orderBy: sortField
      ? sortDirection === 'asc'
        ? [asc((schema.inspections as Record<string, any>)[sortField])]
        : [desc((schema.inspections as Record<string, any>)[sortField])]
      : [desc(schema.inspections.startedAt)],
  })

  return inspections.map((inspection) => {
    const passCount = inspection.items?.filter((i) => i.result === 'pass').length ?? 0
    const failCount = inspection.items?.filter((i) => i.result === 'fail').length ?? 0
    const naCount = inspection.items?.filter((i) => i.result === 'na').length ?? 0

    return {
      ...inspection,
      inspectionNumber: inspection.id.slice(0, 8).toUpperCase(),
      templateName: inspection.template?.name ?? '',
      assetNumber: inspection.asset?.assetNumber ?? '',
      assetMake: inspection.asset?.make ?? '',
      assetModel: inspection.asset?.model ?? '',
      operatorName: inspection.operator
        ? `${inspection.operator.firstName} ${inspection.operator.lastName}`
        : '',
      passCount,
      failCount,
      naCount,
    }
  })
}

/**
 * Fetch and format fuel transaction data for export
 */
export async function fetchFuelTransactionsForExport(
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  const conditions = buildFilterConditions('fuel_transactions', filters, organisationId)

  const transactions = await db.query.fuelTransactions.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      user: true,
    },
    orderBy: sortField
      ? sortDirection === 'asc'
        ? [asc((schema.fuelTransactions as Record<string, any>)[sortField])]
        : [desc((schema.fuelTransactions as Record<string, any>)[sortField])]
      : [desc(schema.fuelTransactions.transactionDate)],
  })

  return transactions.map((tx) => ({
    ...tx,
    transactionNumber: tx.id.slice(0, 8).toUpperCase(),
    assetNumber: tx.asset?.assetNumber ?? '',
    assetMake: tx.asset?.make ?? '',
    assetModel: tx.asset?.model ?? '',
    operatorName: tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : '',
    quantity: tx.quantity ? Number(tx.quantity) : 0,
    unitCost: tx.unitCost ? Number(tx.unitCost) : null,
    totalCost: tx.totalCost ? Number(tx.totalCost) : null,
    odometer: tx.odometer ? Number(tx.odometer) : null,
    engineHours: tx.engineHours ? Number(tx.engineHours) : null,
  }))
}

/**
 * Fetch data for export based on entity type
 */
export async function fetchDataForExport(
  entity: ExportEntityType,
  organisationId: string,
  filters: ExportFilterConfig[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc',
): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case 'assets':
      return fetchAssetsForExport(organisationId, filters, sortField, sortDirection)
    case 'work_orders':
      return fetchWorkOrdersForExport(organisationId, filters, sortField, sortDirection)
    case 'parts':
      return fetchPartsForExport(organisationId, filters, sortField, sortDirection)
    case 'inspections':
      return fetchInspectionsForExport(organisationId, filters, sortField, sortDirection)
    case 'fuel_transactions':
      return fetchFuelTransactionsForExport(organisationId, filters, sortField, sortDirection)
    default:
      throw new Error(`Unknown entity type: ${entity}`)
  }
}

/**
 * Generate export file content
 */
export function generateExportContent(
  data: Record<string, unknown>[],
  columns: ExportColumnConfig[],
  format: ExportFormat,
  sheetName = 'Export',
): { content: string; mimeType: string; extension: string } {
  if (format === 'xlsx') {
    return {
      content: generateExcel(data, columns, sheetName),
      mimeType: 'application/vnd.ms-excel',
      extension: 'xls',
    }
  }

  return {
    content: generateCSV(data, columns),
    mimeType: 'text/csv',
    extension: 'csv',
  }
}

/**
 * Calculate next run time for scheduled export
 */
export function calculateNextRunTime(
  frequency: 'daily' | 'weekly' | 'monthly',
  scheduleDay: string | null,
  scheduleTime: string,
  fromDate: Date = new Date(),
): Date {
  const timeParts = scheduleTime.split(':').map(Number)
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0
  const next = new Date(fromDate)
  next.setHours(hours, minutes, 0, 0)

  switch (frequency) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (next <= fromDate) {
        next.setDate(next.getDate() + 1)
      }
      break

    case 'weekly': {
      const targetDay = Number.parseInt(scheduleDay || '0', 10) // 0 = Sunday
      const currentDay = next.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil < 0 || (daysUntil === 0 && next <= fromDate)) {
        daysUntil += 7
      }
      next.setDate(next.getDate() + daysUntil)
      break
    }

    case 'monthly': {
      const targetDate = Number.parseInt(scheduleDay || '1', 10)
      next.setDate(targetDate)
      // If the date has passed or is today but time has passed, move to next month
      if (next <= fromDate) {
        next.setMonth(next.getMonth() + 1)
      }
      // Handle months with fewer days
      if (next.getDate() !== targetDate) {
        next.setDate(0) // Last day of previous month
      }
      break
    }
  }

  return next
}
