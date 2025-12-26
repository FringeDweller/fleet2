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

  // Fetch the schedule
  const schedule = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(schema.maintenanceSchedules.id, id),
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)
    )
  })

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Maintenance schedule not found'
    })
  }

  // Generate preview occurrences
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
    count: occurrences.length,
    occurrences: occurrences.map(occ => ({
      dueDate: occ.dueDate.toISOString(),
      leadDate: occ.leadDate.toISOString()
    }))
  }
})
