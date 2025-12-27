import { db, schema } from '../../../utils/db'
import { eq, and } from 'drizzle-orm'
import { previewScheduleOccurrences } from '../../../utils/schedule-calculator'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Schedule ID is required'
    })
  }

  const query = getQuery(event)
  const count = query.count ? parseInt(query.count as string, 10) : 10

  if (isNaN(count) || count < 1 || count > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Count must be between 1 and 100'
    })
  }

  // Fetch the schedule with asset data (for usage-based schedules)
  const schedule = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(schema.maintenanceSchedules.id, id),
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
    ),
    with: {
      asset: true
    }
  })

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Maintenance schedule not found'
    })
  }

  // Handle different schedule types
  if (schedule.scheduleType === 'usage_based') {
    // For usage-based schedules, return current usage vs thresholds
    if (!schedule.asset) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Usage-based schedules require a specific asset'
      })
    }

    const currentMileage = schedule.asset.mileage ? parseFloat(schedule.asset.mileage) : null
    const currentHours = schedule.asset.operationalHours ? parseFloat(schedule.asset.operationalHours) : null

    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scheduleType: 'usage_based',
      currentMileage,
      currentHours,
      mileage: schedule.intervalMileage
        ? {
            interval: schedule.intervalMileage,
            lastTriggered: schedule.lastTriggeredMileage
              ? parseFloat(schedule.lastTriggeredMileage)
              : 0,
            nextTrigger: (schedule.lastTriggeredMileage
              ? parseFloat(schedule.lastTriggeredMileage)
              : 0) + schedule.intervalMileage,
            progress: currentMileage
              ? Math.round(((currentMileage - (schedule.lastTriggeredMileage
                  ? parseFloat(schedule.lastTriggeredMileage)
                  : 0)) / schedule.intervalMileage) * 100)
              : 0,
            alertReached: currentMileage
              ? ((currentMileage - (schedule.lastTriggeredMileage
                  ? parseFloat(schedule.lastTriggeredMileage)
                  : 0)) / schedule.intervalMileage) * 100 >= (schedule.thresholdAlertPercent || 90)
              : false
          }
        : null,
      hours: schedule.intervalHours
        ? {
            interval: schedule.intervalHours,
            lastTriggered: schedule.lastTriggeredHours
              ? parseFloat(schedule.lastTriggeredHours)
              : 0,
            nextTrigger: (schedule.lastTriggeredHours
              ? parseFloat(schedule.lastTriggeredHours)
              : 0) + schedule.intervalHours,
            progress: currentHours
              ? Math.round(((currentHours - (schedule.lastTriggeredHours
                  ? parseFloat(schedule.lastTriggeredHours)
                  : 0)) / schedule.intervalHours) * 100)
              : 0,
            alertReached: currentHours
              ? ((currentHours - (schedule.lastTriggeredHours
                  ? parseFloat(schedule.lastTriggeredHours)
                  : 0)) / schedule.intervalHours) * 100 >= (schedule.thresholdAlertPercent || 90)
              : false
          }
        : null
    }
  }

  // For time-based and combined schedules, generate preview occurrences
  if (!schedule.intervalType || !schedule.startDate) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Time-based schedules require intervalType and startDate'
    })
  }

  const occurrences = previewScheduleOccurrences(
    {
      intervalType: schedule.intervalType,
      intervalValue: schedule.intervalValue,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      monthOfYear: schedule.monthOfYear,
      leadTimeDays: schedule.leadTimeDays
    },
    count
  )

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scheduleType: schedule.scheduleType,
    count: occurrences.length,
    occurrences: occurrences.map(occ => ({
      dueDate: occ.dueDate.toISOString(),
      leadDate: occ.leadDate.toISOString()
    }))
  }
})
