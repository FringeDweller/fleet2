import { eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { isSuperAdmin, requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Super admins can see all organisations
  if (isSuperAdmin(user)) {
    const organisations = await db.query.organisations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    })
    return organisations
  }

  // Regular users can only see their own organisation
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
  })

  if (!organisation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organisation not found',
    })
  }

  return [organisation]
})
