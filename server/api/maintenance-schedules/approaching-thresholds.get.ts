import { db, schema } from '../../utils/db'
import { eq, and, or, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Fetch all active, non-archived usage-based schedules
  const schedules = await db.query.maintenanceSchedules.findMany({
    where: and(
      eq(schema.maintenanceSchedules.organisationId, session.user.organisationId),
      eq(schema.maintenanceSchedules.isActive, true),
      eq(schema.maintenanceSchedules.isArchived, false),
      or(
        eq(schema.maintenanceSchedules.scheduleType, 'usage_based'),
        eq(schema.maintenanceSchedules.scheduleType, 'combined')
      ),
      or(
        isNotNull(schema.maintenanceSchedules.intervalMileage),
        isNotNull(schema.maintenanceSchedules.intervalHours)
      )
    ),
    with: {
      asset: true,
      template: true
    }
  })

  // Calculate threshold status for each schedule
  const approachingSchedules = schedules
    .map((schedule) => {
      if (!schedule.asset) {
        return null
      }

      const currentMileage = schedule.asset.mileage ? parseFloat(schedule.asset.mileage) : null
      const currentHours = schedule.asset.operationalHours ? parseFloat(schedule.asset.operationalHours) : null

      const mileageStatus = schedule.intervalMileage && currentMileage !== null
        ? calculateUsageStatus(
            currentMileage,
            schedule.lastTriggeredMileage ? parseFloat(schedule.lastTriggeredMileage) : 0,
            schedule.intervalMileage
          )
        : null

      const hoursStatus = schedule.intervalHours && currentHours !== null
        ? calculateUsageStatus(
            currentHours,
            schedule.lastTriggeredHours ? parseFloat(schedule.lastTriggeredHours) : 0,
            schedule.intervalHours
          )
        : null

      // Only include schedules that have reached the threshold
      const mileageAlert = mileageStatus && mileageStatus.progress >= (schedule.thresholdAlertPercent || 90)
      const hoursAlert = hoursStatus && hoursStatus.progress >= (schedule.thresholdAlertPercent || 90)

      if (!mileageAlert && !hoursAlert) {
        return null
      }

      // Determine urgency level
      const maxProgress = Math.max(
        mileageStatus?.progress || 0,
        hoursStatus?.progress || 0
      )

      let urgency: 'approaching' | 'due' | 'overdue'
      if (maxProgress >= 100) {
        urgency = 'overdue'
      } else if (maxProgress >= 95) {
        urgency = 'due'
      } else {
        urgency = 'approaching'
      }

      return {
        id: schedule.id,
        name: schedule.name,
        scheduleType: schedule.scheduleType,
        assetId: schedule.assetId,
        assetNumber: schedule.asset.assetNumber,
        assetName: `${schedule.asset.make || ''} ${schedule.asset.model || ''}`.trim() || schedule.asset.assetNumber,
        templateId: schedule.templateId,
        templateName: schedule.template?.name,
        mileage: mileageAlert
          ? {
              current: currentMileage,
              lastTriggered: schedule.lastTriggeredMileage
                ? parseFloat(schedule.lastTriggeredMileage)
                : 0,
              interval: schedule.intervalMileage,
              nextTrigger: mileageStatus!.nextTrigger,
              progress: mileageStatus!.progress,
              remaining: mileageStatus!.remaining
            }
          : null,
        hours: hoursAlert
          ? {
              current: currentHours,
              lastTriggered: schedule.lastTriggeredHours
                ? parseFloat(schedule.lastTriggeredHours)
                : 0,
              interval: schedule.intervalHours,
              nextTrigger: hoursStatus!.nextTrigger,
              progress: hoursStatus!.progress,
              remaining: hoursStatus!.remaining
            }
          : null,
        urgency,
        thresholdPercent: schedule.thresholdAlertPercent || 90
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      // Sort by urgency (overdue > due > approaching), then by progress descending
      const urgencyOrder = { overdue: 3, due: 2, approaching: 1 }
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
      }
      const aProgress = Math.max(a.mileage?.progress || 0, a.hours?.progress || 0)
      const bProgress = Math.max(b.mileage?.progress || 0, b.hours?.progress || 0)
      return bProgress - aProgress
    })

  return {
    count: approachingSchedules.length,
    schedules: approachingSchedules
  }
})

function calculateUsageStatus(
  current: number,
  lastTriggered: number,
  interval: number
) {
  const usedSinceLastTrigger = current - lastTriggered
  const nextTrigger = lastTriggered + interval
  const remaining = nextTrigger - current
  const progress = Math.round((usedSinceLastTrigger / interval) * 100)

  return {
    nextTrigger,
    remaining,
    progress
  }
}
