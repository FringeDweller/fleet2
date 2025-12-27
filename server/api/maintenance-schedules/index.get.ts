import { db, schema } from '../../utils/db'
import { eq, and, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const assetId = query.assetId as string | undefined
  const categoryId = query.categoryId as string | undefined
  const intervalType = query.intervalType as string | undefined
  const scheduleType = query.scheduleType as string | undefined
  const isActive = query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined

  const conditions = [eq(schema.maintenanceSchedules.organisationId, session.user.organisationId)]

  // Always exclude archived schedules unless explicitly requested
  const includeArchived = query.includeArchived === 'true'
  if (!includeArchived) {
    conditions.push(eq(schema.maintenanceSchedules.isArchived, false))
  }

  // Filter by active status
  if (isActive !== undefined) {
    conditions.push(eq(schema.maintenanceSchedules.isActive, isActive))
  }

  // Filter by asset
  if (assetId) {
    conditions.push(eq(schema.maintenanceSchedules.assetId, assetId))
  }

  // Filter by category
  if (categoryId) {
    conditions.push(eq(schema.maintenanceSchedules.categoryId, categoryId))
  }

  // Filter by interval type
  const validIntervalTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'] as const
  if (intervalType && validIntervalTypes.includes(intervalType as typeof validIntervalTypes[number])) {
    conditions.push(eq(schema.maintenanceSchedules.intervalType, intervalType as typeof validIntervalTypes[number]))
  }

  // Filter by schedule type
  const validScheduleTypes = ['time_based', 'usage_based', 'combined'] as const
  if (scheduleType && validScheduleTypes.includes(scheduleType as typeof validScheduleTypes[number])) {
    conditions.push(eq(schema.maintenanceSchedules.scheduleType, scheduleType as typeof validScheduleTypes[number]))
  }

  // Search by name or description
  if (search) {
    conditions.push(
      or(
        ilike(schema.maintenanceSchedules.name, `%${search}%`),
        ilike(schema.maintenanceSchedules.description, `%${search}%`)
      )!
    )
  }

  const schedules = await db.query.maintenanceSchedules.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      category: true,
      template: true,
      defaultAssignee: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: (schedules, { desc }) => [desc(schedules.createdAt)]
  })

  return schedules
})
