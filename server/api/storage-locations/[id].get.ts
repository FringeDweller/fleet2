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

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Location ID is required',
    })
  }

  const location = await db.query.storageLocations.findFirst({
    where: and(
      eq(schema.storageLocations.id, id),
      eq(schema.storageLocations.organisationId, session.user.organisationId),
    ),
    with: {
      parent: true,
      children: true,
    },
  })

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Location not found',
    })
  }

  return location
})
