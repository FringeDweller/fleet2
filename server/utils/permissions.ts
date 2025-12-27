import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { DEFAULT_ROLE_PERMISSIONS, ROLES, type RoleName } from '../db/schema/roles'
import { db, schema } from './db'

export type Permission =
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'work_orders:read'
  | 'work_orders:write'
  | 'work_orders:delete'
  | 'reports:read'
  | 'reports:write'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'settings:read'
  | 'settings:write'
  | 'parts:read'
  | 'parts:write'
  | 'parts:delete'
  | 'maintenance:read'
  | 'maintenance:write'
  | 'maintenance:delete'
  | '*'

export interface UserWithPermissions {
  id: string
  organisationId: string
  roleId: string
  roleName: RoleName
  permissions: string[]
  email: string
  firstName: string
  lastName: string
  phone: string | null
  avatarUrl: string | null
  isActive: boolean
  emailVerified: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(permissions: string[], required: Permission): boolean {
  // Admin with wildcard has all permissions
  if (permissions.includes('*')) {
    return true
  }
  return permissions.includes(required)
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(permissions: string[], required: Permission[]): boolean {
  if (permissions.includes('*')) {
    return true
  }
  return required.some((p) => permissions.includes(p))
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(permissions: string[], required: Permission[]): boolean {
  if (permissions.includes('*')) {
    return true
  }
  return required.every((p) => permissions.includes(p))
}

/**
 * Get user session with permissions from session
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(event: H3Event): Promise<UserWithPermissions | null> {
  const session = await getUserSession(event)
  if (!session?.user) {
    return null
  }

  // Check if session already has permissions (set at login)
  const user = session.user as UserWithPermissions
  if (user.permissions && user.roleName) {
    return user
  }

  // Fallback: fetch role from database if not in session
  const role = await db.query.roles.findFirst({
    where: eq(schema.roles.id, session.user.roleId),
  })

  if (!role) {
    return null
  }

  return {
    ...session.user,
    roleName: role.name as RoleName,
    permissions: role.permissions || DEFAULT_ROLE_PERMISSIONS[role.name as RoleName] || [],
  }
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(event: H3Event): Promise<UserWithPermissions> {
  const user = await getAuthenticatedUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  return user
}

/**
 * Require specific permission - throws 403 if permission not granted
 */
export async function requirePermission(
  event: H3Event,
  permission: Permission,
): Promise<UserWithPermissions> {
  const user = await requireAuth(event)

  if (!hasPermission(user.permissions, permission)) {
    // Log access denial
    await logAccessDenial(event, user, permission)

    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions',
      data: { required: permission },
    })
  }

  return user
}

/**
 * Require any of the specified permissions
 */
export async function requireAnyPermission(
  event: H3Event,
  permissions: Permission[],
): Promise<UserWithPermissions> {
  const user = await requireAuth(event)

  if (!hasAnyPermission(user.permissions, permissions)) {
    await logAccessDenial(event, user, permissions.join(' or '))

    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions',
      data: { required: permissions },
    })
  }

  return user
}

/**
 * Require all of the specified permissions
 */
export async function requireAllPermissions(
  event: H3Event,
  permissions: Permission[],
): Promise<UserWithPermissions> {
  const user = await requireAuth(event)

  if (!hasAllPermissions(user.permissions, permissions)) {
    await logAccessDenial(event, user, permissions.join(' and '))

    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions',
      data: { required: permissions },
    })
  }

  return user
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: UserWithPermissions): boolean {
  return user.roleName === ROLES.ADMIN || user.permissions.includes('*')
}

/**
 * Check if user has manager-level role or higher
 */
export function isManager(user: UserWithPermissions): boolean {
  return isAdmin(user) || user.roleName === ROLES.FLEET_MANAGER
}

/**
 * Check if user has supervisor-level role or higher
 */
export function isSupervisor(user: UserWithPermissions): boolean {
  return isManager(user) || user.roleName === ROLES.SUPERVISOR
}

/**
 * Log access denial for audit purposes
 */
async function logAccessDenial(
  event: H3Event,
  user: UserWithPermissions,
  requiredPermission: string,
): Promise<void> {
  try {
    const headers = getHeaders(event)
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'access_denied',
      entityType: 'permission',
      entityId: user.id, // Use user ID as entity
      oldValues: null,
      newValues: {
        requiredPermission,
        path: event.path,
        method: event.method,
        userRole: user.roleName,
        userPermissions: user.permissions,
      },
      ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
      userAgent: headers['user-agent'] || null,
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log access denial:', error)
  }
}
