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
      statusMessage: 'Form ID is required',
    })
  }

  const form = await db.query.customForms.findFirst({
    where: and(
      eq(schema.customForms.id, id),
      eq(schema.customForms.organisationId, session.user.organisationId),
    ),
    with: {
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!form) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form not found',
    })
  }

  return form
})
