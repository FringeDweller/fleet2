import { eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
  })

  if (!organisation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organisation not found',
    })
  }

  return organisation
})
