import { and, eq } from 'drizzle-orm'
import { CacheTTL, cachedList } from '../../utils/cache'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const orgId = session.user.organisationId

  // US-18.1.1: Cache technicians list (used frequently for dropdowns)
  const technicians = await cachedList(
    'technicians',
    orgId,
    { active: true },
    async () => {
      // Get the technician role
      const technicianRole = await db.query.roles.findFirst({
        where: eq(schema.roles.name, 'Technician'),
      })

      if (!technicianRole) {
        return []
      }

      // Get all users with the technician role in the organisation
      return await db.query.users.findMany({
        where: and(
          eq(schema.users.organisationId, orgId),
          eq(schema.users.roleId, technicianRole.id),
          eq(schema.users.isActive, true),
        ),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          phone: true,
        },
        orderBy: (users, { asc }) => [asc(users.firstName), asc(users.lastName)],
      })
    },
    { ttl: CacheTTL.LONG, staleTtl: 30 },
  )

  return technicians
})
