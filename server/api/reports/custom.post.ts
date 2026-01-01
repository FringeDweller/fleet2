/**
 * Custom Report Executor API
 *
 * POST /api/reports/custom
 *
 * Executes a custom report configuration without saving it.
 * Accepts report configuration (entity type, fields, filters, grouping, sorting)
 * and returns formatted results with pagination.
 *
 * Request body:
 * - entityType: 'assets' | 'work_orders' | 'maintenance_schedules' | 'fuel_transactions' | 'inspections' | 'parts' | 'defects'
 * - fields: string[] - columns to select
 * - filters?: CustomReportFilter[] - filter conditions
 * - dateRange?: { field: string, startDate?: string, endDate?: string }
 * - groupBy?: string[] - fields to group by
 * - aggregations?: { field: string, type: 'count' | 'sum' | 'avg' | 'min' | 'max', alias?: string }[]
 * - sorting?: { field: string, direction: 'asc' | 'desc' }
 * - page?: number (default 1)
 * - pageSize?: number (default 50, max 500)
 */

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

// Validation schemas
const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'in',
    'notIn',
    'isNull',
    'isNotNull',
  ]),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
      z.null(),
    ])
    .optional(),
})

const dateRangeSchema = z.object({
  field: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const aggregationSchema = z.object({
  field: z.string().min(1),
  type: z.enum(['count', 'sum', 'avg', 'min', 'max']),
  alias: z.string().optional(),
})

const sortingSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
})

const customReportSchema = z.object({
  entityType: z.enum([
    'assets',
    'work_orders',
    'maintenance_schedules',
    'fuel_transactions',
    'inspections',
    'parts',
    'defects',
  ]),
  fields: z.array(z.string().min(1)).min(1),
  filters: z.array(filterSchema).optional().default([]),
  dateRange: dateRangeSchema.optional(),
  groupBy: z.array(z.string()).optional(),
  aggregations: z.array(aggregationSchema).optional(),
  sorting: sortingSchema.optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(500).optional().default(50),
})

// Column metadata for each entity type
interface ColumnMeta {
  column: PgColumn
  type: 'string' | 'number' | 'boolean' | 'date' | 'uuid'
}

type EntityColumns = Record<string, ColumnMeta>

const entityColumns: Record<string, EntityColumns> = {
  assets: {
    id: { column: schema.assets.id, type: 'uuid' },
    assetNumber: { column: schema.assets.assetNumber, type: 'string' },
    make: { column: schema.assets.make, type: 'string' },
    model: { column: schema.assets.model, type: 'string' },
    year: { column: schema.assets.year, type: 'number' },
    licensePlate: { column: schema.assets.licensePlate, type: 'string' },
    status: { column: schema.assets.status, type: 'string' },
    mileage: { column: schema.assets.mileage, type: 'number' },
    operationalHours: { column: schema.assets.operationalHours, type: 'number' },
    vin: { column: schema.assets.vin, type: 'string' },
    categoryId: { column: schema.assets.categoryId, type: 'uuid' },
    isArchived: { column: schema.assets.isArchived, type: 'boolean' },
    createdAt: { column: schema.assets.createdAt, type: 'date' },
    updatedAt: { column: schema.assets.updatedAt, type: 'date' },
  },
  work_orders: {
    id: { column: schema.workOrders.id, type: 'uuid' },
    workOrderNumber: { column: schema.workOrders.workOrderNumber, type: 'string' },
    title: { column: schema.workOrders.title, type: 'string' },
    status: { column: schema.workOrders.status, type: 'string' },
    priority: { column: schema.workOrders.priority, type: 'string' },
    assetId: { column: schema.workOrders.assetId, type: 'uuid' },
    assignedToId: { column: schema.workOrders.assignedToId, type: 'uuid' },
    dueDate: { column: schema.workOrders.dueDate, type: 'date' },
    completedAt: { column: schema.workOrders.completedAt, type: 'date' },
    laborCost: { column: schema.workOrders.laborCost, type: 'number' },
    partsCost: { column: schema.workOrders.partsCost, type: 'number' },
    totalCost: { column: schema.workOrders.totalCost, type: 'number' },
    estimatedDuration: { column: schema.workOrders.estimatedDuration, type: 'number' },
    actualDuration: { column: schema.workOrders.actualDuration, type: 'number' },
    createdAt: { column: schema.workOrders.createdAt, type: 'date' },
    updatedAt: { column: schema.workOrders.updatedAt, type: 'date' },
  },
  maintenance_schedules: {
    id: { column: schema.maintenanceSchedules.id, type: 'uuid' },
    name: { column: schema.maintenanceSchedules.name, type: 'string' },
    scheduleType: { column: schema.maintenanceSchedules.scheduleType, type: 'string' },
    assetId: { column: schema.maintenanceSchedules.assetId, type: 'uuid' },
    categoryId: { column: schema.maintenanceSchedules.categoryId, type: 'uuid' },
    intervalType: { column: schema.maintenanceSchedules.intervalType, type: 'string' },
    intervalValue: { column: schema.maintenanceSchedules.intervalValue, type: 'number' },
    intervalMileage: { column: schema.maintenanceSchedules.intervalMileage, type: 'number' },
    intervalHours: { column: schema.maintenanceSchedules.intervalHours, type: 'number' },
    nextDueDate: { column: schema.maintenanceSchedules.nextDueDate, type: 'date' },
    lastGeneratedAt: { column: schema.maintenanceSchedules.lastGeneratedAt, type: 'date' },
    isActive: { column: schema.maintenanceSchedules.isActive, type: 'boolean' },
    createdAt: { column: schema.maintenanceSchedules.createdAt, type: 'date' },
    updatedAt: { column: schema.maintenanceSchedules.updatedAt, type: 'date' },
  },
  fuel_transactions: {
    id: { column: schema.fuelTransactions.id, type: 'uuid' },
    assetId: { column: schema.fuelTransactions.assetId, type: 'uuid' },
    quantity: { column: schema.fuelTransactions.quantity, type: 'number' },
    unitCost: { column: schema.fuelTransactions.unitCost, type: 'number' },
    totalCost: { column: schema.fuelTransactions.totalCost, type: 'number' },
    fuelType: { column: schema.fuelTransactions.fuelType, type: 'string' },
    odometer: { column: schema.fuelTransactions.odometer, type: 'number' },
    engineHours: { column: schema.fuelTransactions.engineHours, type: 'number' },
    vendor: { column: schema.fuelTransactions.vendor, type: 'string' },
    transactionDate: { column: schema.fuelTransactions.transactionDate, type: 'date' },
    hasDiscrepancy: { column: schema.fuelTransactions.hasDiscrepancy, type: 'boolean' },
    source: { column: schema.fuelTransactions.source, type: 'string' },
    createdAt: { column: schema.fuelTransactions.createdAt, type: 'date' },
    updatedAt: { column: schema.fuelTransactions.updatedAt, type: 'date' },
  },
  inspections: {
    id: { column: schema.inspections.id, type: 'uuid' },
    assetId: { column: schema.inspections.assetId, type: 'uuid' },
    templateId: { column: schema.inspections.templateId, type: 'uuid' },
    operatorId: { column: schema.inspections.operatorId, type: 'uuid' },
    status: { column: schema.inspections.status, type: 'string' },
    initiationMethod: { column: schema.inspections.initiationMethod, type: 'string' },
    overallResult: { column: schema.inspections.overallResult, type: 'string' },
    startedAt: { column: schema.inspections.startedAt, type: 'date' },
    completedAt: { column: schema.inspections.completedAt, type: 'date' },
    syncStatus: { column: schema.inspections.syncStatus, type: 'string' },
    createdAt: { column: schema.inspections.createdAt, type: 'date' },
    updatedAt: { column: schema.inspections.updatedAt, type: 'date' },
  },
  parts: {
    id: { column: schema.parts.id, type: 'uuid' },
    sku: { column: schema.parts.sku, type: 'string' },
    name: { column: schema.parts.name, type: 'string' },
    description: { column: schema.parts.description, type: 'string' },
    categoryId: { column: schema.parts.categoryId, type: 'uuid' },
    unit: { column: schema.parts.unit, type: 'string' },
    quantityInStock: { column: schema.parts.quantityInStock, type: 'number' },
    minimumStock: { column: schema.parts.minimumStock, type: 'number' },
    reorderThreshold: { column: schema.parts.reorderThreshold, type: 'number' },
    reorderQuantity: { column: schema.parts.reorderQuantity, type: 'number' },
    unitCost: { column: schema.parts.unitCost, type: 'number' },
    supplier: { column: schema.parts.supplier, type: 'string' },
    supplierPartNumber: { column: schema.parts.supplierPartNumber, type: 'string' },
    location: { column: schema.parts.location, type: 'string' },
    onOrderQuantity: { column: schema.parts.onOrderQuantity, type: 'number' },
    onOrderDate: { column: schema.parts.onOrderDate, type: 'date' },
    isActive: { column: schema.parts.isActive, type: 'boolean' },
    createdAt: { column: schema.parts.createdAt, type: 'date' },
    updatedAt: { column: schema.parts.updatedAt, type: 'date' },
  },
  defects: {
    id: { column: schema.defects.id, type: 'uuid' },
    assetId: { column: schema.defects.assetId, type: 'uuid' },
    inspectionId: { column: schema.defects.inspectionId, type: 'uuid' },
    inspectionItemId: { column: schema.defects.inspectionItemId, type: 'uuid' },
    workOrderId: { column: schema.defects.workOrderId, type: 'uuid' },
    reportedById: { column: schema.defects.reportedById, type: 'uuid' },
    title: { column: schema.defects.title, type: 'string' },
    description: { column: schema.defects.description, type: 'string' },
    category: { column: schema.defects.category, type: 'string' },
    severity: { column: schema.defects.severity, type: 'string' },
    status: { column: schema.defects.status, type: 'string' },
    location: { column: schema.defects.location, type: 'string' },
    resolvedById: { column: schema.defects.resolvedById, type: 'uuid' },
    resolvedAt: { column: schema.defects.resolvedAt, type: 'date' },
    resolutionNotes: { column: schema.defects.resolutionNotes, type: 'string' },
    reportedAt: { column: schema.defects.reportedAt, type: 'date' },
    updatedAt: { column: schema.defects.updatedAt, type: 'date' },
  },
}

// Get the base table for an entity type
function getBaseTable(entityType: string): PgTable {
  switch (entityType) {
    case 'assets':
      return schema.assets
    case 'work_orders':
      return schema.workOrders
    case 'maintenance_schedules':
      return schema.maintenanceSchedules
    case 'fuel_transactions':
      return schema.fuelTransactions
    case 'inspections':
      return schema.inspections
    case 'parts':
      return schema.parts
    case 'defects':
      return schema.defects
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

// Get the organisation ID column for an entity type
function getOrgIdColumn(entityType: string): PgColumn {
  switch (entityType) {
    case 'assets':
      return schema.assets.organisationId
    case 'work_orders':
      return schema.workOrders.organisationId
    case 'maintenance_schedules':
      return schema.maintenanceSchedules.organisationId
    case 'fuel_transactions':
      return schema.fuelTransactions.organisationId
    case 'inspections':
      return schema.inspections.organisationId
    case 'parts':
      return schema.parts.organisationId
    case 'defects':
      return schema.defects.organisationId
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

// Build a filter condition from filter definition
function buildFilterCondition(
  filter: z.infer<typeof filterSchema>,
  columnMeta: ColumnMeta,
): SQL | undefined {
  const { column, type } = columnMeta
  const { operator, value } = filter

  switch (operator) {
    case 'eq':
      if (value === null) return isNull(column)
      return eq(column, value as string | number | boolean)
    case 'neq':
      if (value === null) return isNotNull(column)
      return ne(column, value as string | number | boolean)
    case 'gt':
      if (type === 'date') return gt(column, new Date(value as string))
      return gt(column, value as number)
    case 'gte':
      if (type === 'date') return gte(column, new Date(value as string))
      return gte(column, value as number)
    case 'lt':
      if (type === 'date') return lt(column, new Date(value as string))
      return lt(column, value as number)
    case 'lte':
      if (type === 'date') return lte(column, new Date(value as string))
      return lte(column, value as number)
    case 'like':
      return ilike(column, `%${value}%`)
    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        return inArray(column, value as string[] | number[])
      }
      return undefined
    case 'notIn':
      if (Array.isArray(value) && value.length > 0) {
        return notInArray(column, value as string[] | number[])
      }
      return undefined
    case 'isNull':
      return isNull(column)
    case 'isNotNull':
      return isNotNull(column)
    default:
      return undefined
  }
}

// Build aggregation SQL
function buildAggregationSql(
  agg: z.infer<typeof aggregationSchema>,
  columnMeta: ColumnMeta,
): { sql: SQL; alias: string } {
  const { column } = columnMeta
  const alias = agg.alias || `${agg.type}_${agg.field}`

  switch (agg.type) {
    case 'count':
      return { sql: sql<number>`count(${column})::int`, alias }
    case 'sum':
      return { sql: sql<number>`sum(${column})::numeric`, alias }
    case 'avg':
      return { sql: sql<number>`avg(${column})::numeric`, alias }
    case 'min':
      return { sql: sql`min(${column})`, alias }
    case 'max':
      return { sql: sql`max(${column})`, alias }
    default:
      throw new Error(`Unknown aggregation type: ${agg.type}`)
  }
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const parseResult = customReportSchema.safeParse(body)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parseResult.error.flatten(),
    })
  }

  const { entityType, fields, filters, dateRange, groupBy, aggregations, sorting, page, pageSize } =
    parseResult.data

  const columns = entityColumns[entityType]

  if (!columns) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown entity type: ${entityType}`,
    })
  }

  // Validate that all requested fields exist
  for (const field of fields) {
    if (!columns[field]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown field: ${field} for entity type: ${entityType}`,
      })
    }
  }

  // Validate filter fields
  for (const filter of filters) {
    if (!columns[filter.field]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown filter field: ${filter.field} for entity type: ${entityType}`,
      })
    }
  }

  // Validate groupBy fields
  if (groupBy) {
    for (const field of groupBy) {
      if (!columns[field]) {
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown groupBy field: ${field} for entity type: ${entityType}`,
        })
      }
    }
  }

  // Validate aggregation fields
  if (aggregations) {
    for (const agg of aggregations) {
      if (!columns[agg.field]) {
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown aggregation field: ${agg.field} for entity type: ${entityType}`,
        })
      }
    }
  }

  // Validate sorting field
  if (sorting && !columns[sorting.field]) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown sorting field: ${sorting.field} for entity type: ${entityType}`,
    })
  }

  // Build WHERE conditions
  const conditions: SQL[] = [eq(getOrgIdColumn(entityType), session.user.organisationId)]

  // Add date range filter if provided
  if (dateRange) {
    const dateColumn = columns[dateRange.field]
    if (dateColumn) {
      if (dateRange.startDate) {
        conditions.push(gte(dateColumn.column, new Date(dateRange.startDate)))
      }
      if (dateRange.endDate) {
        conditions.push(lte(dateColumn.column, new Date(dateRange.endDate)))
      }
    }
  }

  // Add custom filters
  for (const filter of filters) {
    const columnMeta = columns[filter.field]
    if (columnMeta) {
      const condition = buildFilterCondition(filter, columnMeta)
      if (condition) {
        conditions.push(condition)
      }
    }
  }

  const whereClause = and(...conditions)
  const table = getBaseTable(entityType)

  // Determine if we're doing aggregation
  const hasAggregation = aggregations && aggregations.length > 0
  const hasGroupBy = groupBy && groupBy.length > 0

  let data: Record<string, unknown>[]
  let total: number

  if (hasAggregation && hasGroupBy) {
    // Aggregation with GROUP BY
    const selectFields: Record<string, SQL | PgColumn> = {}

    // Add GROUP BY columns to select
    for (const fieldName of groupBy) {
      const columnMeta = columns[fieldName]
      if (columnMeta) {
        selectFields[fieldName] = columnMeta.column
      }
    }

    // Add aggregations to select
    for (const agg of aggregations) {
      const columnMeta = columns[agg.field]
      if (columnMeta) {
        const { sql: aggSql, alias } = buildAggregationSql(agg, columnMeta)
        selectFields[alias] = aggSql
      }
    }

    // Build GROUP BY columns
    const groupByColumns = groupBy
      .map((fieldName) => columns[fieldName]?.column)
      .filter((col): col is PgColumn => Boolean(col))

    // Build query
    let query = db
      .select(selectFields)
      .from(table)
      .where(whereClause)
      .groupBy(...groupByColumns)

    // Apply ordering
    if (sorting) {
      const orderColumn = columns[sorting.field]?.column
      if (orderColumn) {
        const orderClause = sorting.direction === 'desc' ? desc(orderColumn) : asc(orderColumn)
        query = query.orderBy(orderClause) as typeof query
      }
    }

    // Apply pagination
    data = await query.limit(pageSize).offset((page - 1) * pageSize)

    // Get total count of groups
    const countResult = await db
      .select({ count: sql<number>`count(distinct (${sql.join(groupByColumns, sql`, `)}))::int` })
      .from(table)
      .where(whereClause)

    total = countResult[0]?.count || 0
  } else if (hasAggregation && !hasGroupBy) {
    // Aggregation without GROUP BY (single row result)
    const selectFields: Record<string, SQL> = {}

    for (const agg of aggregations!) {
      const columnMeta = columns[agg.field]
      if (columnMeta) {
        const { sql: aggSql, alias } = buildAggregationSql(agg, columnMeta)
        selectFields[alias] = aggSql
      }
    }

    data = await db.select(selectFields).from(table).where(whereClause)
    total = 1
  } else {
    // Regular query without aggregation
    const selectFields: Record<string, PgColumn> = {}

    for (const field of fields) {
      const columnMeta = columns[field]
      if (columnMeta) {
        selectFields[field] = columnMeta.column
      }
    }

    // Build query
    let query = db.select(selectFields).from(table).where(whereClause)

    // Apply ordering
    if (sorting) {
      const orderColumn = columns[sorting.field]?.column
      if (orderColumn) {
        const orderClause = sorting.direction === 'desc' ? desc(orderColumn) : asc(orderColumn)
        query = query.orderBy(orderClause) as typeof query
      }
    }

    // Apply pagination
    data = await query.limit(pageSize).offset((page - 1) * pageSize)

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(whereClause)

    total = countResult[0]?.count || 0
  }

  // Format response with field metadata
  const fieldMetadata = fields.map((field) => ({
    field,
    type: columns[field]?.type || 'unknown',
  }))

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    fields: fieldMetadata,
    entityType,
  }
})
