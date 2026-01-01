import { and, asc, count, desc, eq, gte, ilike, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { isAdmin, requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Filters
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Sorting
  sortBy: z.enum(['createdAt', 'action', 'entityType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * Get paginated audit log entries with filters
 * GET /api/admin/audit-log
 * Requires admin access
 */
export default defineEventHandler(async (event) => {
  // Require settings:read permission and admin role
  const currentUser = await requirePermission(event, 'settings:read')

  // Admin-only access check
  if (!isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { page, limit, action, userId, entityType, startDate, endDate, sortBy, sortOrder } =
    result.data

  // Build conditions - always filter by organisation
  const conditions = [eq(schema.auditLog.organisationId, currentUser.organisationId)]

  // Filter by action (partial match)
  if (action && action.trim() !== '') {
    conditions.push(ilike(schema.auditLog.action, `%${action.trim()}%`))
  }

  // Filter by user ID
  if (userId) {
    conditions.push(eq(schema.auditLog.userId, userId))
  }

  // Filter by entity type (partial match)
  if (entityType && entityType.trim() !== '') {
    conditions.push(ilike(schema.auditLog.entityType, `%${entityType.trim()}%`))
  }

  // Filter by date range
  if (startDate) {
    const fromDate = new Date(startDate)
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(schema.auditLog.createdAt, fromDate))
    }
  }

  if (endDate) {
    const toDate = new Date(endDate)
    if (!Number.isNaN(toDate.getTime())) {
      // Set to end of day
      toDate.setHours(23, 59, 59, 999)
      conditions.push(lte(schema.auditLog.createdAt, toDate))
    }
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db.select({ value: count() }).from(schema.auditLog).where(whereClause)

  const total = countResult[0]?.value || 0
  const offset = (page - 1) * limit
  const totalPages = Math.ceil(total / limit)

  // Build order by clause
  const sortFn = sortOrder === 'asc' ? asc : desc
  let orderByClause

  switch (sortBy) {
    case 'action':
      orderByClause = sortFn(schema.auditLog.action)
      break
    case 'entityType':
      orderByClause = sortFn(schema.auditLog.entityType)
      break
    default:
      // 'createdAt' is the default
      orderByClause = sortFn(schema.auditLog.createdAt)
  }

  // Fetch audit logs with user info joined
  const logs = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      oldValues: schema.auditLog.oldValues,
      newValues: schema.auditLog.newValues,
      ipAddress: schema.auditLog.ipAddress,
      userAgent: schema.auditLog.userAgent,
      createdAt: schema.auditLog.createdAt,
      userId: schema.auditLog.userId,
      userFirstName: schema.users.firstName,
      userLastName: schema.users.lastName,
      userEmail: schema.users.email,
      userAvatarUrl: schema.users.avatarUrl,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset)

  // Format response
  const formattedLogs = logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    oldValues: log.oldValues,
    newValues: log.newValues,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
    user: log.userId
      ? {
          id: log.userId,
          firstName: log.userFirstName,
          lastName: log.userLastName,
          name: `${log.userFirstName} ${log.userLastName}`,
          email: log.userEmail,
          avatar: { src: log.userAvatarUrl || undefined },
        }
      : null,
  }))

  return {
    data: formattedLogs,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  }
})
