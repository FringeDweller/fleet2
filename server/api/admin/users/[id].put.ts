import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES, type RoleName } from '../../../db/schema/roles'
import { hashPasswordArgon2 } from '../../../utils/auth'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).nullable().optional(),
  roleId: z.string().uuid('Invalid role ID').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100).optional(),
  isActive: z.boolean().optional(),
})

/**
 * Update user details
 * PUT /api/admin/users/[id]
 * Requires admin permissions
 */
export default defineEventHandler(async (event) => {
  // Require users:write permission
  const currentUser = await requirePermission(event, 'users:write')

  // Additional check: must be admin to update users
  if (!isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const updates = result.data

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

  // Prevent users from deactivating themselves
  if (userId === currentUser.id && updates.isActive === false) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot deactivate your own account',
    })
  }

  // Prevent users from demoting themselves (changing their own role)
  if (userId === currentUser.id && updates.roleId && updates.roleId !== currentUser.roleId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot change your own role',
    })
  }

  // If role is being changed, verify the new role
  let newRole = targetUser.role
  if (updates.roleId && updates.roleId !== targetUser.roleId) {
    const role = await db.query.roles.findFirst({
      where: eq(schema.roles.id, updates.roleId),
    })

    if (!role) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid role ID',
      })
    }

    // Prevent non-super-admins from assigning super admin role
    if (role.name === ROLES.SUPER_ADMIN && currentUser.roleName !== ROLES.SUPER_ADMIN) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can assign super admin role',
      })
    }

    // Prevent non-super-admins from changing super admin users
    if (targetUser.role?.name === ROLES.SUPER_ADMIN && currentUser.roleName !== ROLES.SUPER_ADMIN) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can modify super admin users',
      })
    }

    newRole = role
  }

  // Check for email uniqueness if email is being changed
  if (updates.email && updates.email.toLowerCase() !== targetUser.email) {
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, updates.email.toLowerCase()),
    })

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email already in use',
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

  if (updates.email !== undefined && updates.email.toLowerCase() !== targetUser.email) {
    oldValues.email = targetUser.email
    newValues.email = updates.email.toLowerCase()
    updateData.email = updates.email.toLowerCase()
    // Reset email verification when email changes
    updateData.emailVerified = false
  }

  if (updates.firstName !== undefined && updates.firstName !== targetUser.firstName) {
    oldValues.firstName = targetUser.firstName
    newValues.firstName = updates.firstName
    updateData.firstName = updates.firstName
  }

  if (updates.lastName !== undefined && updates.lastName !== targetUser.lastName) {
    oldValues.lastName = targetUser.lastName
    newValues.lastName = updates.lastName
    updateData.lastName = updates.lastName
  }

  if (updates.phone !== undefined && updates.phone !== targetUser.phone) {
    oldValues.phone = targetUser.phone
    newValues.phone = updates.phone
    updateData.phone = updates.phone
  }

  if (updates.roleId !== undefined && updates.roleId !== targetUser.roleId) {
    oldValues.roleId = targetUser.roleId
    newValues.roleId = updates.roleId
    updateData.roleId = updates.roleId
  }

  if (updates.isActive !== undefined && updates.isActive !== targetUser.isActive) {
    oldValues.isActive = targetUser.isActive
    newValues.isActive = updates.isActive
    updateData.isActive = updates.isActive
  }

  // Hash new password if provided
  if (updates.password) {
    updateData.passwordHash = await hashPasswordArgon2(updates.password)
    newValues.passwordChanged = true
    // Reset failed login attempts when password changes
    updateData.failedLoginAttempts = 0
    updateData.lockedUntil = null
  }

  // Only update if there are changes
  if (Object.keys(updateData).length === 1) {
    // Only updatedAt
    return {
      success: true,
      user: formatUserResponse(targetUser, newRole),
      message: 'No changes detected',
    }
  }

  // Update user
  const [updatedUser] = await db
    .update(schema.users)
    .set(updateData)
    .where(eq(schema.users.id, userId))
    .returning()

  if (!updatedUser) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user',
    })
  }

  // Log update in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'update',
    entityType: 'user',
    entityId: userId,
    oldValues,
    newValues,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  // Send notification if account was deactivated
  if (updates.isActive === false && targetUser.isActive === true) {
    await db.insert(schema.notifications).values({
      organisationId: currentUser.organisationId,
      userId: targetUser.id,
      title: 'Account Deactivated',
      body: 'Your account has been deactivated by an administrator.',
      type: 'system',
      isRead: false,
    })
  }

  // Send notification if role was changed
  if (updates.roleId && updates.roleId !== targetUser.roleId && newRole) {
    await db.insert(schema.notifications).values({
      organisationId: currentUser.organisationId,
      userId: targetUser.id,
      title: 'Role Updated',
      body: `Your role has been changed to ${newRole.displayName}.`,
      type: 'system',
      isRead: false,
    })
  }

  return {
    success: true,
    user: formatUserResponse(updatedUser, newRole),
  }
})

function formatUserResponse(
  user: typeof schema.users.$inferSelect,
  role: typeof schema.roles.$inferSelect | null,
) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: role
      ? {
          id: role.id,
          name: role.name as RoleName,
          displayName: role.displayName,
        }
      : null,
  }
}
