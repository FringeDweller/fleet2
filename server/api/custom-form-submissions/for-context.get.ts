import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * GET /api/custom-form-submissions/for-context
 * Get all submissions for a specific context (e.g., work order, asset)
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)

  const contextType = query.contextType as string
  const contextId = query.contextId as string

  if (!contextType || !contextId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Context type and ID are required',
    })
  }

  const submissions = await db.query.customFormSubmissions.findMany({
    where: and(
      eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
      eq(schema.customFormSubmissions.contextType, contextType),
      eq(schema.customFormSubmissions.contextId, contextId),
    ),
    orderBy: [desc(schema.customFormSubmissions.submittedAt)],
    with: {
      form: {
        columns: {
          id: true,
          name: true,
        },
      },
      version: {
        columns: {
          id: true,
          version: true,
        },
      },
      submittedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return {
    data: submissions,
  }
})
