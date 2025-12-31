/**
 * Update Custom Report API (US-14.7)
 *
 * PUT /api/reports/custom/:id
 *
 * Updates an existing custom report definition
 */

import { and, eq } from 'drizzle-orm'
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

const updateReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  definition: definitionSchema.optional(),
  isShared: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Report ID is required',
    })
  }

  // Check that report exists and user owns it
  const existingReport = await db.query.customReports.findFirst({
    where: and(
      eq(schema.customReports.id, id),
      eq(schema.customReports.organisationId, session.user.organisationId),
      eq(schema.customReports.userId, session.user.id), // Only owner can update
    ),
  })

  if (!existingReport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Custom report not found or you do not have permission to update it',
    })
  }

  const body = await readBody(event)
  const result = updateReportSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.name !== undefined) {
    updates.name = result.data.name
  }
  if (result.data.description !== undefined) {
    updates.description = result.data.description
  }
  if (result.data.definition !== undefined) {
    updates.definition = result.data.definition
  }
  if (result.data.isShared !== undefined) {
    updates.isShared = result.data.isShared
  }

  const [updatedReport] = await db
    .update(schema.customReports)
    .set(updates)
    .where(eq(schema.customReports.id, id))
    .returning()

  if (!updatedReport) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update custom report',
    })
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'custom_report',
    entityId: updatedReport.id,
    oldValues: { name: existingReport.name, isShared: existingReport.isShared },
    newValues: result.data,
  })

  return updatedReport
})
