/**
 * Create scheduled export (US-17.7)
 *
 * POST /api/admin/export/scheduled - Create a new scheduled export
 */

import { z } from 'zod'
import {
  calculateNextRunTime,
  type ExportEntityType,
  getExportableColumns,
} from '../../../../utils/data-export'
import { db, schema } from '../../../../utils/db'

const entityTypes = ['assets', 'work_orders', 'parts', 'inspections', 'fuel_transactions'] as const

const filterSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
})

const columnSchema = z.object({
  field: z.string(),
  label: z.string(),
  enabled: z.boolean(),
})

const createScheduledExportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  entity: z.enum(entityTypes),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  columns: z.array(columnSchema).min(1),
  filters: z.array(filterSchema).optional().default([]),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional().default('asc'),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  scheduleDay: z.string().optional(),
  scheduleTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'),
  emailRecipients: z.array(z.string().email()).optional().default([]),
  isActive: z.boolean().optional().default(true),
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
  const parsed = createScheduledExportSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: parsed.error.flatten(),
    })
  }

  const data = parsed.data

  // Validate that all selected columns exist for the entity
  const availableColumns = getExportableColumns(data.entity as ExportEntityType)
  const availableFields = new Set(availableColumns.map((c) => c.field))

  for (const col of data.columns) {
    if (!availableFields.has(col.field)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid column '${col.field}' for entity '${data.entity}'`,
      })
    }
  }

  // Validate schedule day based on frequency
  if (data.frequency === 'weekly') {
    const day = Number.parseInt(data.scheduleDay || '0', 10)
    if (Number.isNaN(day) || day < 0 || day > 6) {
      throw createError({
        statusCode: 400,
        statusMessage: 'For weekly frequency, scheduleDay must be 0-6 (Sunday-Saturday)',
      })
    }
  } else if (data.frequency === 'monthly') {
    const day = Number.parseInt(data.scheduleDay || '1', 10)
    if (Number.isNaN(day) || day < 1 || day > 28) {
      throw createError({
        statusCode: 400,
        statusMessage: 'For monthly frequency, scheduleDay must be 1-28',
      })
    }
  }

  // Calculate next run time
  const nextRunAt = data.isActive
    ? calculateNextRunTime(data.frequency, data.scheduleDay ?? null, data.scheduleTime)
    : null

  const result = await db
    .insert(schema.scheduledExports)
    .values({
      organisationId: session.user.organisationId,
      createdById: session.user.id,
      name: data.name,
      description: data.description,
      entity: data.entity,
      format: data.format,
      columns: data.columns,
      filters: data.filters,
      sortField: data.sortField,
      sortDirection: data.sortDirection,
      frequency: data.frequency,
      scheduleDay: data.scheduleDay,
      scheduleTime: data.scheduleTime,
      emailRecipients: data.emailRecipients,
      isActive: data.isActive,
      nextRunAt,
    })
    .returning()

  const scheduledExport = result[0]
  if (!scheduledExport) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create scheduled export',
    })
  }

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'scheduled_exports',
    entityId: scheduledExport.id,
    newValues: {
      name: data.name,
      entity: data.entity,
      frequency: data.frequency,
      format: data.format,
    },
  })

  return scheduledExport
})
