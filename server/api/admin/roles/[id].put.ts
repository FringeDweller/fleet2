import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../../db/schema/roles'
import { db, schema } from '../../../utils/db'
import { isAdmin, isSuperAdmin, requirePermission } from '../../../utils/permissions'

// List of all available permissions in the system
const AVAILABLE_PERMISSIONS = [
  'assets:read',
  'assets:write',
  'assets:delete',
  'work_orders:read',
  'work_orders:write',
  'work_orders:delete',
  'reports:read',
  'reports:write',
  'users:read',
  'users:write',
  'users:delete',
  'settings:read',
  'settings:write',
  'parts:read',
  'parts:write',
  'parts:delete',
  'maintenance:read',
  'maintenance:write',
  'maintenance:delete',
  'organisations:read',
  'organisations:write',
  'organisations:delete',
] as const

const updateRoleSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  permissions: z.array(z.string()).optional(),
})

// System roles that cannot be modified
const SYSTEM_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN]

/**
 * Update a role
 * PUT /api/admin/roles/[id]
 * Requires admin permissions
 */
export default defineEventHandler(async (event) => {
  // Require users:write permission
  const currentUser = await requirePermission(event, 'users:write')

  // Additional check: must be admin to update roles
  if (!isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  const roleId = getRouterParam(event, 'id')
  if (!roleId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateRoleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const updates = result.data

  // Verify role exists
  const existingRole = await db.query.roles.findFirst({
    where: eq(schema.roles.id, roleId),
  })

  if (!existingRole) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Role not found',
    })
  }

  // Prevent modification of system roles (super_admin, admin) by non-super-admins
  if (
    SYSTEM_ROLES.includes(existingRole.name as typeof ROLES.SUPER_ADMIN) &&
    !isSuperAdmin(currentUser)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'System roles can only be modified by super admins',
    })
  }

  // Validate and filter permissions if provided
  let validPermissions: string[] | undefined
  if (updates.permissions !== undefined) {
    validPermissions = updates.permissions.filter(
      (p) =>
        AVAILABLE_PERMISSIONS.includes(p as (typeof AVAILABLE_PERMISSIONS)[number]) ||
        p === '*' ||
        p === '**',
    )

    // Prevent non-super-admins from assigning super admin permissions
    if (validPermissions.includes('**') && !isSuperAdmin(currentUser)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can assign cross-tenant access permissions',
      })
    }

    // Prevent non-super-admins from assigning wildcard permissions
    if (validPermissions.includes('*') && !isSuperAdmin(currentUser)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can assign full admin permissions',
      })
    }
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  // Track old values for audit log
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}

  if (updates.displayName !== undefined && updates.displayName !== existingRole.displayName) {
    oldValues.displayName = existingRole.displayName
    newValues.displayName = updates.displayName
    updateData.displayName = updates.displayName
  }

  if (updates.description !== undefined && updates.description !== existingRole.description) {
    oldValues.description = existingRole.description
    newValues.description = updates.description
    updateData.description = updates.description
  }

  if (validPermissions !== undefined) {
    const oldPerms = existingRole.permissions || []
    const newPerms = validPermissions
    // Only track if permissions actually changed
    if (JSON.stringify(oldPerms.sort()) !== JSON.stringify(newPerms.sort())) {
      oldValues.permissions = oldPerms
      newValues.permissions = newPerms
      updateData.permissions = newPerms
    }
  }

  // Only update if there are changes
  if (Object.keys(updateData).length === 1) {
    // Only updatedAt
    return {
      success: true,
      role: formatRoleResponse(existingRole),
      message: 'No changes detected',
    }
  }

  // Update role
  const [updatedRole] = await db
    .update(schema.roles)
    .set(updateData)
    .where(eq(schema.roles.id, roleId))
    .returning()

  if (!updatedRole) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update role',
    })
  }

  // Log update in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'update',
    entityType: 'role',
    entityId: roleId,
    oldValues,
    newValues,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  // Get user count for response
  const userCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.users)
    .where(eq(schema.users.roleId, roleId))

  return {
    success: true,
    role: {
      ...formatRoleResponse(updatedRole),
      userCount: userCountResult[0]?.count || 0,
    },
  }
})

function formatRoleResponse(role: typeof schema.roles.$inferSelect) {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    permissions: role.permissions || [],
    permissionCount: (role.permissions || []).length,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}
