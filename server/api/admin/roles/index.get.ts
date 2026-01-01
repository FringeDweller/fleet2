import { asc, count, desc, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const querySchema = z.object({
  // Search by name
  search: z.string().optional(),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Sorting
  sortBy: z.enum(['name', 'displayName', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * List all roles
 * GET /api/admin/roles
 * Requires admin permissions
 */
export default defineEventHandler(async (event) => {
  // Require users:read permission
  const currentUser = await requirePermission(event, 'users:read')

  // Additional check: must be admin to access role management
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

  const { search, page, limit, sortBy, sortOrder } = result.data

  // Build conditions
  const conditions = []

  // Search by name or display name
  if (search && search.trim() !== '') {
    const searchTerm = `%${search.trim()}%`
    conditions.push(
      sql`(${ilike(schema.roles.name, searchTerm)} OR ${ilike(schema.roles.displayName, searchTerm)})`,
    )
  }

  const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined

  // Get total count
  const countResult = await db.select({ value: count() }).from(schema.roles).where(whereClause)

  const total = countResult[0]?.value || 0
  const offset = (page - 1) * limit
  const totalPages = Math.ceil(total / limit)

  // Build order by clause
  const sortFn = sortOrder === 'asc' ? asc : desc
  let orderByClause

  switch (sortBy) {
    case 'displayName':
      orderByClause = sortFn(schema.roles.displayName)
      break
    case 'createdAt':
      orderByClause = sortFn(schema.roles.createdAt)
      break
    default:
      orderByClause = sortFn(schema.roles.name)
  }

  // Fetch roles with user count
  const roles = await db
    .select({
      id: schema.roles.id,
      name: schema.roles.name,
      displayName: schema.roles.displayName,
      description: schema.roles.description,
      permissions: schema.roles.permissions,
      createdAt: schema.roles.createdAt,
      updatedAt: schema.roles.updatedAt,
      userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.role_id = ${schema.roles.id})::int`,
    })
    .from(schema.roles)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset)

  // Format response
  const formattedRoles = roles.map((role) => ({
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    permissions: role.permissions || [],
    permissionCount: (role.permissions || []).length,
    userCount: role.userCount,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }))

  return {
    data: formattedRoles,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  }
})
