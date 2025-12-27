import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { calculateNextDueDate } from '../../utils/schedule-calculator'

const createScheduleSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional().nullable(),
    assetId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),

    // Schedule type
    scheduleType: z.enum(['time_based', 'usage_based', 'combined']).default('time_based'),

    // Time-based fields (now optional)
    intervalType: z
      .enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'])
      .optional()
      .nullable(),
    intervalValue: z.number().int().positive().default(1),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
    monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),

    // Usage-based fields
    intervalMileage: z.number().int().positive().optional().nullable(),
    intervalHours: z.number().int().positive().optional().nullable(),
    thresholdAlertPercent: z.number().int().min(1).max(100).default(90),

    leadTimeDays: z.number().int().min(0).default(7),
    defaultPriority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    defaultAssigneeId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Either assetId or categoryId must be provided, but not both
      const hasAsset = !!data.assetId
      const hasCategory = !!data.categoryId
      return (hasAsset || hasCategory) && !(hasAsset && hasCategory)
    },
    {
      message: 'Either assetId or categoryId must be provided, but not both',
      path: ['assetId'],
    },
  )
  .refine(
    (data) => {
      // For time_based schedules, intervalType and startDate are required
      if (data.scheduleType === 'time_based' || data.scheduleType === 'combined') {
        return !!data.intervalType && !!data.startDate
      }
      return true
    },
    {
      message: 'intervalType and startDate are required for time_based and combined schedules',
      path: ['intervalType'],
    },
  )
  .refine(
    (data) => {
      // For usage_based schedules, at least one of intervalMileage or intervalHours is required
      if (data.scheduleType === 'usage_based' || data.scheduleType === 'combined') {
        return !!data.intervalMileage || !!data.intervalHours
      }
      return true
    },
    {
      message:
        'At least one of intervalMileage or intervalHours is required for usage_based and combined schedules',
      path: ['intervalMileage'],
    },
  )

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = createScheduleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Calculate the first nextDueDate from startDate (only for time-based schedules)
  let nextDueDate: Date | null = null
  if (data.scheduleType === 'time_based' || data.scheduleType === 'combined') {
    if (data.intervalType && data.startDate) {
      nextDueDate = calculateNextDueDate(
        data.intervalType,
        data.intervalValue,
        new Date(data.startDate),
        data.dayOfWeek,
        data.dayOfMonth,
        data.monthOfYear,
      )
    }
  }

  // Create the schedule
  const [schedule] = await db
    .insert(schema.maintenanceSchedules)
    .values({
      organisationId: session.user.organisationId,
      name: data.name,
      description: data.description,
      scheduleType: data.scheduleType,
      assetId: data.assetId,
      categoryId: data.categoryId,
      templateId: data.templateId,
      intervalType: data.intervalType,
      intervalValue: data.intervalValue,
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
      monthOfYear: data.monthOfYear,
      intervalMileage: data.intervalMileage,
      intervalHours: data.intervalHours,
      thresholdAlertPercent: data.thresholdAlertPercent,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextDueDate,
      leadTimeDays: data.leadTimeDays,
      defaultPriority: data.defaultPriority,
      defaultAssigneeId: data.defaultAssigneeId,
      isActive: data.isActive,
      createdById: session.user.id,
    })
    .returning()

  if (!schedule) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create maintenance schedule',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'maintenance_schedule',
    entityId: schedule.id,
    newValues: schedule,
  })

  return schedule
})
