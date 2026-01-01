import { eq, sql } from 'drizzle-orm'
import { ROLES } from '../../../db/schema/roles'
import { db, schema } from '../../../utils/db'
import { isAdmin, isSuperAdmin, requirePermission } from '../../../utils/permissions'

// System roles that cannot be deleted
const PROTECTED_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.FLEET_MANAGER,
  ROLES.SUPERVISOR,
  ROLES.TECHNICIAN,
  ROLES.OPERATOR,
]

/**
 * Delete a role
 * DELETE /api/admin/roles/[id]
 * Requires admin permissions
 * Cannot delete roles that have users assigned or system roles
 */
export default defineEventHandler(async (event) => {
  // Require users:write permission
  const currentUser = await requirePermission(event, 'users:write')

  // Additional check: must be admin to delete roles
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

  // Prevent deletion of protected system roles
  if (PROTECTED_ROLES.includes(existingRole.name as (typeof PROTECTED_ROLES)[number])) {
    throw createError({
      statusCode: 403,
      statusMessage: 'System roles cannot be deleted',
    })
  }

  // Only super admins can delete any custom role
  // Regular admins can only delete roles they created (if we tracked that)
  // For now, we'll allow admins to delete custom roles
  if (existingRole.permissions?.includes('**') && !isSuperAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only super admins can delete roles with cross-tenant access',
    })
  }

  // Check if any users have this role assigned
  const userCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.users)
    .where(eq(schema.users.roleId, roleId))

  const userCount = userCountResult[0]?.count || 0

  if (userCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot delete role: ${userCount} user(s) still assigned to this role. Reassign users first.`,
    })
  }

  // Delete the role
  await db.delete(schema.roles).where(eq(schema.roles.id, roleId))

  // Log the deletion in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'delete',
    entityType: 'role',
    entityId: roleId,
    oldValues: {
      name: existingRole.name,
      displayName: existingRole.displayName,
      description: existingRole.description,
      permissions: existingRole.permissions,
    },
    newValues: null,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: `Role "${existingRole.displayName}" has been deleted`,
  }
})
