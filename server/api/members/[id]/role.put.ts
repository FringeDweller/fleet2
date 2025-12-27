import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../../db/schema/roles'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const updateRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
})

export default defineEventHandler(async (event) => {
  // Only users with users:write permission can change roles
  const currentUser = await requirePermission(event, 'users:write')

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
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

  const { roleId } = result.data

  // Verify target user exists and is in same organisation
  const targetUser = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, userId),
      eq(schema.users.organisationId, currentUser.organisationId),
    ),
    with: {
      role: true,
    },
  })

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  // Verify new role exists
  const newRole = await db.query.roles.findFirst({
    where: eq(schema.roles.id, roleId),
  })

  if (!newRole) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Role not found',
    })
  }

  // Only admins can assign admin role
  if (newRole.name === ROLES.ADMIN && !isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only admins can assign admin role',
    })
  }

  // Prevent removing last admin
  if (targetUser.role?.name === ROLES.ADMIN && newRole.name !== ROLES.ADMIN) {
    const adminCount = await db
      .select({ count: schema.users.id })
      .from(schema.users)
      .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.users.organisationId, currentUser.organisationId),
          eq(schema.roles.name, ROLES.ADMIN),
          eq(schema.users.isActive, true),
        ),
      )

    if (adminCount.length <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot remove the last admin from the organisation',
      })
    }
  }

  // Update user role
  const [updatedUser] = await db
    .update(schema.users)
    .set({
      roleId,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning()

  if (!updatedUser) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user role',
    })
  }

  // Log role change in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'role_change',
    entityType: 'user',
    entityId: userId,
    oldValues: {
      roleId: targetUser.roleId,
      roleName: targetUser.role?.name,
    },
    newValues: {
      roleId: roleId,
      roleName: newRole.name,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    user: {
      id: updatedUser.id,
      roleId: updatedUser.roleId,
      roleName: newRole.name,
      roleDisplayName: newRole.displayName,
    },
  }
})
