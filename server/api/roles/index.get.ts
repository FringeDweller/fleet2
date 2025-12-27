import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Any authenticated user can view roles
  await requireAuth(event)

  const roles = await db.query.roles.findMany({
    orderBy: (roles, { asc }) => [asc(roles.name)],
  })

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    permissions: role.permissions,
  }))
})
