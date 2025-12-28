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
      statusMessage: 'Template ID is required',
    })
  }

  const template = await db.query.inspectionTemplates.findFirst({
    where: and(
      eq(schema.inspectionTemplates.id, id),
      eq(schema.inspectionTemplates.organisationId, session.user.organisationId),
    ),
    with: {
      category: {
        columns: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection template not found',
    })
  }

  return template
})
