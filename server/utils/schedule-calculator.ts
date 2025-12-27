/**
 * Calculate the next due date for a maintenance schedule
 *
 * @param intervalType - Type of interval (daily, weekly, monthly, etc.)
 * @param intervalValue - Number of intervals (e.g., 2 for every 2 weeks)
 * @param fromDate - Starting date to calculate from
 * @param dayOfWeek - For weekly schedules: 0=Sunday, 6=Saturday
 * @param dayOfMonth - For monthly/quarterly/annually: 1-31
 * @param monthOfYear - For annually: 1-12
 * @returns The next due date
 */
export function calculateNextDueDate(
  intervalType: string,
  intervalValue: number,
  fromDate: Date,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): Date {
  const next = new Date(fromDate)

  switch (intervalType) {
    case 'daily':
      next.setDate(next.getDate() + intervalValue)
      break

    case 'weekly':
      next.setDate(next.getDate() + 7 * intervalValue)
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        const currentDay = next.getDay()
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7
        next.setDate(next.getDate() + daysUntilTarget)
      }
      break

    case 'monthly':
      next.setMonth(next.getMonth() + intervalValue)
      if (dayOfMonth) {
        // Handle month overflow (e.g., February 31 -> last day of February)
        next.setDate(
          Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
        )
      }
      break

    case 'quarterly':
      next.setMonth(next.getMonth() + 3 * intervalValue)
      if (dayOfMonth) {
        next.setDate(
          Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
        )
      }
      break

    case 'annually':
      next.setFullYear(next.getFullYear() + intervalValue)
      if (monthOfYear) next.setMonth(monthOfYear - 1)
      if (dayOfMonth) {
        next.setDate(
          Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
        )
      }
      break

    case 'custom':
      // Custom interval is in days
      next.setDate(next.getDate() + intervalValue)
      break
  }

  return next
}

/**
 * Generate preview of next N occurrences for a schedule
 *
 * @param config - Schedule configuration
 * @param count - Number of occurrences to generate
 * @returns Array of due dates with their lead dates
 */
export function previewScheduleOccurrences(
  config: {
    intervalType: string
    intervalValue: number
    startDate: Date
    endDate?: Date | null
    dayOfWeek?: number | null
    dayOfMonth?: number | null
    monthOfYear?: number | null
    leadTimeDays: number
  },
  count: number = 10
): Array<{ dueDate: Date; leadDate: Date }> {
  const occurrences: Array<{ dueDate: Date; leadDate: Date }> = []
  let currentDate = new Date(config.startDate)

  for (let i = 0; i < count; i++) {
    const dueDate = calculateNextDueDate(
      config.intervalType,
      config.intervalValue,
      currentDate,
      config.dayOfWeek,
      config.dayOfMonth,
      config.monthOfYear
    )

    // Stop if we've passed the end date
    if (config.endDate && dueDate > config.endDate) {
      break
    }

    // Calculate when the work order should be created (leadTimeDays before due date)
    const leadDate = new Date(dueDate)
    leadDate.setDate(leadDate.getDate() - config.leadTimeDays)

    occurrences.push({ dueDate, leadDate })
    currentDate = dueDate
  }

  return occurrences
}
