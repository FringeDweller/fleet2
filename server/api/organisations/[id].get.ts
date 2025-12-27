import { eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { isSuperAdmin, requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const orgId = getRouterParam(event, 'id')

  if (!orgId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organisation ID is required',
    })
  }

  // Users can only view their own organisation, unless super admin
  if (orgId !== user.organisationId && !isSuperAdmin(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Cannot access other organisations',
    })
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, orgId),
  })

  if (!organisation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organisation not found',
    })
  }

  return organisation
})
