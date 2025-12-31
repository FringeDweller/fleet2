import { and, desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * GET /api/custom-form-submissions
 * List form submissions with optional filtering
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

  const formId = query.formId as string | undefined
  const contextType = query.contextType as string | undefined
  const contextId = query.contextId as string | undefined
  const status = query.status as string | undefined
  const page = Number.parseInt(String(query.page || '1'), 10)
  const limit = Math.min(Number.parseInt(String(query.limit || '20'), 10), 100)
  const offset = (page - 1) * limit

  // Build where conditions
  const conditions = [eq(schema.customFormSubmissions.organisationId, session.user.organisationId)]

  if (formId) {
    conditions.push(eq(schema.customFormSubmissions.formId, formId))
  }

  if (contextType) {
    conditions.push(eq(schema.customFormSubmissions.contextType, contextType))
  }

  if (contextId) {
    conditions.push(eq(schema.customFormSubmissions.contextId, contextId))
  }

  if (status) {
    conditions.push(eq(schema.customFormSubmissions.status, status as never))
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormSubmissions)
    .where(and(...conditions))

  const total = countResult[0]?.count || 0

  // Get submissions
  const submissions = await db.query.customFormSubmissions.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.customFormSubmissions.submittedAt)],
    limit,
    offset,
    with: {
      form: {
        columns: {
          id: true,
          name: true,
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})
