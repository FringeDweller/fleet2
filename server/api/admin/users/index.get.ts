import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { RoleName } from '../../../db/schema/roles'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const querySchema = z.object({
  // Search by name or email
  search: z.string().optional(),
  // Filter by role
  roleId: z.string().uuid().optional(),
  roleName: z.string().optional(),
  // Filter by status
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Sorting
  sortBy: z.enum(['name', 'email', 'role', 'createdAt', 'lastLoginAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * List all users for the current organisation
 * GET /api/admin/users
 * Requires admin permissions (users:read + users:write)
 */
export default defineEventHandler(async (event) => {
  // Require users:read permission - but we'll also check for admin
  const currentUser = await requirePermission(event, 'users:read')

  // Additional check: must be admin to access user management
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

  const { search, roleId, roleName, status, page, limit, sortBy, sortOrder } = result.data

  // Build conditions
  const conditions = [eq(schema.users.organisationId, currentUser.organisationId)]

  // Search by name or email
  if (search && search.trim() !== '') {
    const searchTerm = `%${search.trim()}%`
    conditions.push(
      or(
        ilike(schema.users.email, searchTerm),
        ilike(schema.users.firstName, searchTerm),
        ilike(schema.users.lastName, searchTerm),
        sql`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName}) ILIKE ${searchTerm}`,
      )!,
    )
  }

  // Filter by role ID
  if (roleId) {
    conditions.push(eq(schema.users.roleId, roleId))
  }

  // Filter by role name
  if (roleName && !roleId) {
    // Find role by name first
    const role = await db.query.roles.findFirst({
      where: eq(schema.roles.name, roleName),
    })
    if (role) {
      conditions.push(eq(schema.users.roleId, role.id))
    }
  }

  // Filter by status
  if (status === 'active') {
    conditions.push(eq(schema.users.isActive, true))
  } else if (status === 'inactive') {
    conditions.push(eq(schema.users.isActive, false))
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db.select({ value: count() }).from(schema.users).where(whereClause)

  const total = countResult[0]?.value || 0
  const offset = (page - 1) * limit
  const totalPages = Math.ceil(total / limit)

  // Build order by clause
  const sortFn = sortOrder === 'asc' ? asc : desc
  let orderByClause

  switch (sortBy) {
    case 'email':
      orderByClause = sortFn(schema.users.email)
      break
    case 'role':
      orderByClause = sortFn(schema.roles.displayName)
      break
    case 'createdAt':
      orderByClause = sortFn(schema.users.createdAt)
      break
    case 'lastLoginAt':
      orderByClause = sortFn(schema.users.lastLoginAt)
      break
    default:
      // 'name' or fallback
      orderByClause = [sortFn(schema.users.firstName), sortFn(schema.users.lastName)]
  }

  // Fetch users with their roles
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      avatarUrl: schema.users.avatarUrl,
      isActive: schema.users.isActive,
      emailVerified: schema.users.emailVerified,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      roleId: schema.users.roleId,
      roleName: schema.roles.name,
      roleDisplayName: schema.roles.displayName,
    })
    .from(schema.users)
    .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(whereClause)
    .orderBy(...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]))
    .limit(limit)
    .offset(offset)

  // Format response
  const formattedUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`,
    phone: user.phone,
    avatar: { src: user.avatarUrl || undefined },
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: {
      id: user.roleId,
      name: user.roleName as RoleName,
      displayName: user.roleDisplayName || user.roleName,
    },
  }))

  return {
    data: formattedUsers,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  }
})
