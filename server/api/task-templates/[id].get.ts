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
      statusMessage: 'Template ID is required'
    })
  }

  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, id),
      eq(schema.taskTemplates.organisationId, session.user.organisationId)
    )
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found'
    })
  }

  return template
})
