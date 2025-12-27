import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required'
    })
  }

  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId)
    ),
    with: {
      category: true
    }
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found'
    })
  }

  return asset
})
