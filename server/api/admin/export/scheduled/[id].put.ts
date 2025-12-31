/**
 * Update scheduled export (US-17.7)
 *
 * PUT /api/admin/export/scheduled/:id - Update a scheduled export
 */

import { and, eq } from 'drizzle-orm'
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

const updateScheduledExportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  entity: z.enum(entityTypes).optional(),
  format: z.enum(['csv', 'xlsx']).optional(),
  columns: z.array(columnSchema).min(1).optional(),
  filters: z.array(filterSchema).optional(),
  sortField: z.string().optional().nullable(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  scheduleDay: z.string().optional().nullable(),
  scheduleTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM')
    .optional(),
  emailRecipients: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
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
      statusMessage: 'Export ID is required',
    })
  }

  // Find the scheduled export
  const existing = await db.query.scheduledExports.findFirst({
    where: and(
      eq(schema.scheduledExports.id, id),
      eq(schema.scheduledExports.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scheduled export not found',
    })
  }

  const body = await readBody(event)
  const parsed = updateScheduledExportSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: parsed.error.flatten(),
    })
  }

  const data = parsed.data
  const entity = data.entity ?? existing.entity

  // Validate that all selected columns exist for the entity
  if (data.columns) {
    const availableColumns = getExportableColumns(entity as ExportEntityType)
    const availableFields = new Set(availableColumns.map((c) => c.field))

    for (const col of data.columns) {
      if (!availableFields.has(col.field)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid column '${col.field}' for entity '${entity}'`,
        })
      }
    }
  }

  // Validate schedule day based on frequency
  const frequency = data.frequency ?? existing.frequency
  const scheduleDay = data.scheduleDay !== undefined ? data.scheduleDay : existing.scheduleDay

  if (frequency === 'weekly' && scheduleDay !== null) {
    const day = Number.parseInt(scheduleDay, 10)
    if (Number.isNaN(day) || day < 0 || day > 6) {
      throw createError({
        statusCode: 400,
        statusMessage: 'For weekly frequency, scheduleDay must be 0-6 (Sunday-Saturday)',
      })
    }
  } else if (frequency === 'monthly' && scheduleDay !== null) {
    const day = Number.parseInt(scheduleDay, 10)
    if (Number.isNaN(day) || day < 1 || day > 28) {
      throw createError({
        statusCode: 400,
        statusMessage: 'For monthly frequency, scheduleDay must be 1-28',
      })
    }
  }

  // Calculate next run time if schedule changed
  const isActive = data.isActive ?? existing.isActive
  const scheduleTime = data.scheduleTime ?? existing.scheduleTime
  let nextRunAt = existing.nextRunAt

  if (
    isActive &&
    (data.frequency !== undefined ||
      data.scheduleDay !== undefined ||
      data.scheduleTime !== undefined)
  ) {
    nextRunAt = calculateNextRunTime(frequency, scheduleDay, scheduleTime)
  } else if (!isActive) {
    nextRunAt = null
  }

  const [updated] = await db
    .update(schema.scheduledExports)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.entity !== undefined && { entity: data.entity }),
      ...(data.format !== undefined && { format: data.format }),
      ...(data.columns !== undefined && { columns: data.columns }),
      ...(data.filters !== undefined && { filters: data.filters }),
      ...(data.sortField !== undefined && { sortField: data.sortField }),
      ...(data.sortDirection !== undefined && { sortDirection: data.sortDirection }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.scheduleDay !== undefined && { scheduleDay: data.scheduleDay }),
      ...(data.scheduleTime !== undefined && { scheduleTime: data.scheduleTime }),
      ...(data.emailRecipients !== undefined && { emailRecipients: data.emailRecipients }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledExports.id, id))
    .returning()

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'scheduled_exports',
    entityId: id,
    oldValues: {
      name: existing.name,
      entity: existing.entity,
      frequency: existing.frequency,
      isActive: existing.isActive,
    },
    newValues: data,
  })

  return updated
})
