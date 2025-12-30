import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Get the operator role
  const operatorRole = await db.query.roles.findFirst({
    where: eq(schema.roles.name, 'Operator'),
  })

  if (!operatorRole) {
    return []
  }

  // Get all users with the operator role in the organisation
  const operators = await db.query.users.findMany({
    where: and(
      eq(schema.users.organisationId, session.user.organisationId),
      eq(schema.users.roleId, operatorRole.id),
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

  return operators
})
