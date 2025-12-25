import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get the technician role
  const technicianRole = await db.query.roles.findFirst({
    where: eq(schema.roles.name, 'Technician')
  })

  if (!technicianRole) {
    return []
  }

  // Get all users with the technician role in the organisation
  const technicians = await db.query.users.findMany({
    where: and(
      eq(schema.users.organisationId, session.user.organisationId),
      eq(schema.users.roleId, technicianRole.id),
      eq(schema.users.isActive, true)
    ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      phone: true
    },
    orderBy: (users, { asc }) => [asc(users.firstName), asc(users.lastName)]
  })

  return technicians
})
