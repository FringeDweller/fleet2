import { and, eq } from 'drizzle-orm'
import { ROLES } from '../../db/schema/roles'
import { db, schema } from '../../utils/db'
import { isAdmin, requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require users:delete permission to deactivate members
  const currentUser = await requirePermission(event, 'users:delete')

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
    })
  }

  // Prevent self-deactivation
  if (userId === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot deactivate your own account',
    })
  }

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

  // Only admins can deactivate other admins
  if (targetUser.role?.name === ROLES.ADMIN && !isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only admins can deactivate admin accounts',
    })
  }

  // Prevent deactivating last admin
  if (targetUser.role?.name === ROLES.ADMIN) {
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
        statusMessage: 'Cannot deactivate the last admin in the organisation',
      })
    }
  }

  // Deactivate user (soft delete)
  await db
    .update(schema.users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))

  // Log deactivation in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'deactivate',
    entityType: 'user',
    entityId: userId,
    oldValues: { isActive: true },
    newValues: { isActive: false },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: 'User deactivated successfully',
  }
})
