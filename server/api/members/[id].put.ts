import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  // Require users:write permission to update members
  const currentUser = await requirePermission(event, 'users:write')

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateMemberSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify target user exists and is in same organisation
  const targetUser = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, userId),
      eq(schema.users.organisationId, currentUser.organisationId),
    ),
  })

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  const updates = result.data
  const oldValues = {
    firstName: targetUser.firstName,
    lastName: targetUser.lastName,
    phone: targetUser.phone,
    avatarUrl: targetUser.avatarUrl,
    isActive: targetUser.isActive,
  }

  // Update user
  const [updatedUser] = await db
    .update(schema.users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
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
    newValues: updates,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    user: {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      avatarUrl: updatedUser.avatarUrl,
      isActive: updatedUser.isActive,
    },
  }
})
