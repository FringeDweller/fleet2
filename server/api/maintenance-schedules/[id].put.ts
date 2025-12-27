import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { calculateNextDueDate } from '../../utils/schedule-calculator'

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),

  // Schedule type
  scheduleType: z.enum(['time_based', 'usage_based', 'combined']).optional(),

  // Time-based fields
  intervalType: z
    .enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'])
    .optional()
    .nullable(),
  intervalValue: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),

  // Usage-based fields
  intervalMileage: z.number().int().positive().optional().nullable(),
  intervalHours: z.number().int().positive().optional().nullable(),
  thresholdAlertPercent: z.number().int().min(1).max(100).optional(),

  leadTimeDays: z.number().int().min(0).optional(),
  defaultPriority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  defaultAssigneeId: z.string().uuid().optional().nullable(),
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
      statusMessage: 'Schedule ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateScheduleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Fetch existing schedule
  const existing = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(schema.maintenanceSchedules.id, id),
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Maintenance schedule not found',
    })
  }

  const data = result.data

  // Validate asset/category constraint if being updated
  if (data.assetId !== undefined || data.categoryId !== undefined) {
    const newAssetId = data.assetId !== undefined ? data.assetId : existing.assetId
    const newCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId
    const hasAsset = !!newAssetId
    const hasCategory = !!newCategoryId

    if (!(hasAsset || hasCategory) || (hasAsset && hasCategory)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Either assetId or categoryId must be provided, but not both',
      })
    }
  }

  // Determine if we need to recalculate nextDueDate (only for time-based schedules)
  let nextDueDate = existing.nextDueDate
  const scheduleTimingChanged =
    data.scheduleType !== undefined ||
    data.intervalType !== undefined ||
    data.intervalValue !== undefined ||
    data.dayOfWeek !== undefined ||
    data.dayOfMonth !== undefined ||
    data.monthOfYear !== undefined ||
    data.startDate !== undefined

  if (scheduleTimingChanged) {
    // Use updated or existing values
    const scheduleType = data.scheduleType ?? existing.scheduleType
    const intervalType = data.intervalType !== undefined ? data.intervalType : existing.intervalType
    const intervalValue = data.intervalValue ?? existing.intervalValue
    const startDate =
      data.startDate !== undefined
        ? data.startDate
          ? new Date(data.startDate)
          : null
        : existing.startDate
    const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek
    const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth
    const monthOfYear = data.monthOfYear !== undefined ? data.monthOfYear : existing.monthOfYear

    // Only calculate nextDueDate for time-based schedules
    if (
      (scheduleType === 'time_based' || scheduleType === 'combined') &&
      intervalType &&
      startDate
    ) {
      nextDueDate = calculateNextDueDate(
        intervalType,
        intervalValue,
        startDate,
        dayOfWeek,
        dayOfMonth,
        monthOfYear,
      )
    } else if (scheduleType === 'usage_based') {
      // Usage-based schedules don't use nextDueDate
      nextDueDate = null
    }
  }

  // Update the schedule
  const [updated] = await db
    .update(schema.maintenanceSchedules)
    .set({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate:
        data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
      nextDueDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.maintenanceSchedules.id, id),
        eq(schema.maintenanceSchedules.organisationId, session.user.organisationId),
      ),
    )
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update maintenance schedule',
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'maintenance_schedule',
    entityId: updated.id,
    oldValues: existing,
    newValues: updated,
  })

  return updated
})
