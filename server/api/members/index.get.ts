import { eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require users:read permission to list members
  const currentUser = await requirePermission(event, 'users:read')

  // Get all users in the same organisation with their roles
  const users = await db.query.users.findMany({
    where: eq(schema.users.organisationId, currentUser.organisationId),
    with: {
      role: true,
    },
    orderBy: (users, { asc }) => [asc(users.firstName), asc(users.lastName)],
  })

  return users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phone: user.phone,
    role: user.role?.displayName || user.role?.name || 'Unknown',
    roleId: user.roleId,
    roleName: user.role?.name,
    avatar: { src: user.avatarUrl || undefined },
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }))
})
