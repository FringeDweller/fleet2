import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * GET /api/custom-form-submissions/:id
 * Get a specific form submission
 */
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
      statusMessage: 'Submission ID is required',
    })
  }

  const submission = await db.query.customFormSubmissions.findFirst({
    where: and(
      eq(schema.customFormSubmissions.id, id),
      eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
    ),
    with: {
      form: {
        columns: {
          id: true,
          name: true,
          description: true,
        },
      },
      version: {
        columns: {
          id: true,
          version: true,
          fields: true,
          settings: true,
        },
      },
      submittedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      reviewedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!submission) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Submission not found',
    })
  }

  return submission
})
