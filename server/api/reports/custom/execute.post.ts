/**
 * Execute Custom Report API (US-14.7)
 *
 * POST /api/reports/custom/execute
 *
 * Executes a report definition and returns paginated results
 *
 * Request body:
 * - dataSource: 'assets' | 'work_orders' | 'maintenance_schedules' | 'fuel_transactions' | 'inspections'
 * - definition: CustomReportDefinition
 * - page?: number (default 1)
 * - pageSize?: number (default 50, max 500)
 * - reportId?: string (if running a saved report, updates lastRunAt)
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
import type { CustomReportAggregation, CustomReportFilter } from '../../../db/schema/custom-reports'
import { db, schema } from '../../../utils/db'

const columnSchema = z.object({
  field: z.string().min(1),
  label: z.string().optional(),
  visible: z.boolean().default(true),
  order: z.number().int().min(0),
})

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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  field: z.string().min(1),
})

const aggregationSchema = z.object({
  field: z.string().min(1),
  type: z.enum(['count', 'sum', 'avg', 'min', 'max']),
  alias: z.string().optional(),
})

const definitionSchema = z.object({
  columns: z.array(columnSchema).min(1),
  filters: z.array(filterSchema).default([]),
  dateRange: dateRangeSchema.optional(),
  groupBy: z.array(z.string()).optional(),
  aggregations: z.array(aggregationSchema).optional(),
  orderBy: z
    .object({
      field: z.string().min(1),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  limit: z.number().int().min(1).max(10000).optional(),
})

const executeReportSchema = z.object({
  dataSource: z.enum([
    'assets',
    'work_orders',
    'maintenance_schedules',
    'fuel_transactions',
    'inspections',
  ]),
  definition: definitionSchema,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  reportId: z.string().uuid().optional(),
})

// Column metadata for each data source
const dataSourceColumns: Record<string, Record<string, { column: PgColumn; type: string }>> = {
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
}

// Get the base table for a data source
function getBaseTable(dataSource: string): PgTable {
  switch (dataSource) {
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
    default:
      throw new Error(`Unknown data source: ${dataSource}`)
  }
}

// Get the organisation ID column for a data source
function getOrgIdColumn(dataSource: string): PgColumn {
  switch (dataSource) {
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
    default:
      throw new Error(`Unknown data source: ${dataSource}`)
  }
}

// Build filter conditions from filter definitions
function buildFilterCondition(
  filter: CustomReportFilter,
  columnMeta: { column: PgColumn; type: string },
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

// Build aggregation expression
function buildAggregation(
  agg: CustomReportAggregation,
  columnMeta: { column: PgColumn; type: string },
): SQL {
  const { column } = columnMeta
  const alias = agg.alias || `${agg.type}_${agg.field}`

  switch (agg.type) {
    case 'count':
      return sql`count(${column})::int as ${sql.identifier(alias)}`
    case 'sum':
      return sql`sum(${column})::numeric as ${sql.identifier(alias)}`
    case 'avg':
      return sql`avg(${column})::numeric as ${sql.identifier(alias)}`
    case 'min':
      return sql`min(${column}) as ${sql.identifier(alias)}`
    case 'max':
      return sql`max(${column}) as ${sql.identifier(alias)}`
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
  const result = executeReportSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { dataSource, definition, page, pageSize, reportId } = result.data
  const columns = dataSourceColumns[dataSource]

  if (!columns) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown data source: ${dataSource}`,
    })
  }

  // Validate that all referenced columns exist
  const visibleColumns = definition.columns.filter((c) => c.visible)
  for (const col of visibleColumns) {
    if (!columns[col.field]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown column: ${col.field} for data source: ${dataSource}`,
      })
    }
  }

  // Build WHERE conditions
  const conditions: SQL[] = [eq(getOrgIdColumn(dataSource), session.user.organisationId)]

  // Add date range filter if present
  if (definition.dateRange) {
    const dateField = columns[definition.dateRange.field]
    if (dateField) {
      if (definition.dateRange.startDate) {
        conditions.push(gte(dateField.column, new Date(definition.dateRange.startDate)))
      }
      if (definition.dateRange.endDate) {
        conditions.push(lte(dateField.column, new Date(definition.dateRange.endDate)))
      }
    }
  }

  // Add custom filters
  for (const filter of definition.filters) {
    const columnMeta = columns[filter.field]
    if (columnMeta) {
      const condition = buildFilterCondition(filter, columnMeta)
      if (condition) {
        conditions.push(condition)
      }
    }
  }

  // Add isArchived filter for tables that have it
  if (dataSource === 'assets' && columns.isArchived) {
    // Assets should filter out archived by default - handled separately
  }

  const whereClause = and(...conditions)
  const table = getBaseTable(dataSource)

  // Check if we're doing aggregation
  const hasAggregation = definition.aggregations && definition.aggregations.length > 0
  const hasGroupBy = definition.groupBy && definition.groupBy.length > 0

  let data: Record<string, unknown>[]
  let total: number

  if (hasAggregation && hasGroupBy) {
    // Aggregation with GROUP BY
    const selectFields: Record<string, SQL | PgColumn> = {}

    // Add GROUP BY columns to select
    for (const fieldName of definition.groupBy!) {
      const columnMeta = columns[fieldName]
      if (columnMeta) {
        selectFields[fieldName] = columnMeta.column
      }
    }

    // Add aggregations to select
    for (const agg of definition.aggregations!) {
      const columnMeta = columns[agg.field]
      if (columnMeta) {
        const alias = agg.alias || `${agg.type}_${agg.field}`
        switch (agg.type) {
          case 'count':
            selectFields[alias] = sql<number>`count(${columnMeta.column})::int`
            break
          case 'sum':
            selectFields[alias] = sql<number>`sum(${columnMeta.column})::numeric`
            break
          case 'avg':
            selectFields[alias] = sql<number>`avg(${columnMeta.column})::numeric`
            break
          case 'min':
            selectFields[alias] = sql`min(${columnMeta.column})`
            break
          case 'max':
            selectFields[alias] = sql`max(${columnMeta.column})`
            break
        }
      }
    }

    // Build GROUP BY columns
    const groupByColumns = definition
      .groupBy!.map((fieldName) => columns[fieldName]?.column)
      .filter(Boolean) as PgColumn[]

    // Build ORDER BY
    let orderByClause
    if (definition.orderBy) {
      const orderColumn = columns[definition.orderBy.field]?.column
      if (orderColumn) {
        orderByClause =
          definition.orderBy.direction === 'desc' ? desc(orderColumn) : asc(orderColumn)
      }
    }

    // Execute aggregation query
    const query = db
      .select(selectFields)
      .from(table)
      .where(whereClause)
      .groupBy(...groupByColumns)

    if (orderByClause) {
      data = await query
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    } else {
      data = await query.limit(pageSize).offset((page - 1) * pageSize)
    }

    // Get total count of groups
    const countResult = await db
      .select({ count: sql<number>`count(distinct (${sql.join(groupByColumns, sql`, `)}))::int` })
      .from(table)
      .where(whereClause)

    total = countResult[0]?.count || 0
  } else if (hasAggregation && !hasGroupBy) {
    // Aggregation without GROUP BY (single row result)
    const selectFields: Record<string, SQL> = {}

    for (const agg of definition.aggregations!) {
      const columnMeta = columns[agg.field]
      if (columnMeta) {
        const alias = agg.alias || `${agg.type}_${agg.field}`
        switch (agg.type) {
          case 'count':
            selectFields[alias] = sql<number>`count(${columnMeta.column})::int`
            break
          case 'sum':
            selectFields[alias] = sql<number>`sum(${columnMeta.column})::numeric`
            break
          case 'avg':
            selectFields[alias] = sql<number>`avg(${columnMeta.column})::numeric`
            break
          case 'min':
            selectFields[alias] = sql`min(${columnMeta.column})`
            break
          case 'max':
            selectFields[alias] = sql`max(${columnMeta.column})`
            break
        }
      }
    }

    data = await db.select(selectFields).from(table).where(whereClause)

    total = 1
  } else {
    // Regular query without aggregation
    const selectFields: Record<string, PgColumn> = {}

    for (const col of visibleColumns) {
      const columnMeta = columns[col.field]
      if (columnMeta) {
        selectFields[col.field] = columnMeta.column
      }
    }

    // Build ORDER BY
    let orderByClause
    if (definition.orderBy) {
      const orderColumn = columns[definition.orderBy.field]?.column
      if (orderColumn) {
        orderByClause =
          definition.orderBy.direction === 'desc' ? desc(orderColumn) : asc(orderColumn)
      }
    }

    // Execute query with pagination
    const query = db.select(selectFields).from(table).where(whereClause)

    if (orderByClause) {
      data = await query
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    } else {
      data = await query.limit(pageSize).offset((page - 1) * pageSize)
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(whereClause)

    total = countResult[0]?.count || 0
  }

  // Update lastRunAt if this is a saved report
  if (reportId) {
    await db
      .update(schema.customReports)
      .set({ lastRunAt: new Date() })
      .where(
        and(
          eq(schema.customReports.id, reportId),
          eq(schema.customReports.organisationId, session.user.organisationId),
        ),
      )
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    columns: visibleColumns.map((c) => ({
      field: c.field,
      label: c.label || c.field,
    })),
  }
})
