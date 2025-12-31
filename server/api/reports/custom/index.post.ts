/**
 * Create Custom Report API (US-14.7)
 *
 * POST /api/reports/custom
 *
 * Creates a new custom report definition
 */

import { z } from 'zod'
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

const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  dataSource: z.enum([
    'assets',
    'work_orders',
    'maintenance_schedules',
    'fuel_transactions',
    'inspections',
  ]),
  definition: definitionSchema,
  isShared: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = createReportSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { name, description, dataSource, definition, isShared } = result.data

  const [customReport] = await db
    .insert(schema.customReports)
    .values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      name,
      description,
      dataSource,
      definition,
      isShared,
    })
    .returning()

  if (!customReport) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create custom report',
    })
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'custom_report',
    entityId: customReport.id,
    newValues: { name, dataSource, isShared },
  })

  return customReport
})
