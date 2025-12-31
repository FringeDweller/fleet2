import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

/**
 * GET /api/custom-forms/:id/responses
 * List all submissions for a specific form with filtering
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const formId = getRouterParam(event, 'id')

  if (!formId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Form ID is required',
    })
  }

  // Verify form belongs to organisation
  const form = await db.query.customForms.findFirst({
    where: and(
      eq(schema.customForms.id, formId),
      eq(schema.customForms.organisationId, session.user.organisationId),
    ),
  })

  if (!form) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form not found',
    })
  }

  const query = getQuery(event)

  // Filters
  const status = query.status as string | undefined
  const search = query.search as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const contextType = query.contextType as string | undefined
  const contextId = query.contextId as string | undefined
  const submittedById = query.submittedById as string | undefined

  // Field value filters (JSON format: { fieldId: value })
  const fieldFilters = query.fieldFilters as string | undefined
  let parsedFieldFilters: Record<string, unknown> | undefined
  if (fieldFilters) {
    try {
      parsedFieldFilters = JSON.parse(fieldFilters)
    } catch {
      // Ignore invalid JSON
    }
  }

  // Pagination
  const limit = Math.min(Math.max(Number.parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(Number.parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'submittedAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = ['submittedAt', 'status', 'createdAt']

  // Build conditions
  const conditions = [
    eq(schema.customFormSubmissions.formId, formId),
    eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
  ]

  if (status && ['draft', 'submitted', 'approved', 'rejected'].includes(status)) {
    conditions.push(
      eq(
        schema.customFormSubmissions.status,
        status as 'draft' | 'submitted' | 'approved' | 'rejected',
      ),
    )
  }

  if (dateFrom) {
    conditions.push(gte(schema.customFormSubmissions.submittedAt, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.customFormSubmissions.submittedAt, new Date(dateTo)))
  }

  if (contextType) {
    conditions.push(eq(schema.customFormSubmissions.contextType, contextType))
  }

  if (contextId) {
    conditions.push(eq(schema.customFormSubmissions.contextId, contextId))
  }

  if (submittedById) {
    conditions.push(eq(schema.customFormSubmissions.submittedById, submittedById))
  }

  // Apply field value filters using JSONB containment
  if (parsedFieldFilters && Object.keys(parsedFieldFilters).length > 0) {
    for (const [fieldId, value] of Object.entries(parsedFieldFilters)) {
      // Use JSONB path to filter by field value
      const jsonCondition = sql`${schema.customFormSubmissions.responses}->>${fieldId} = ${String(value)}`
      conditions.push(jsonCondition)
    }
  }

  // Search by submitter notes
  if (search) {
    conditions.push(ilike(schema.customFormSubmissions.submitterNotes, `%${search}%`))
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormSubmissions)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'submittedAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  // Fetch submissions with related data
  const submissions = await db.query.customFormSubmissions.findMany({
    where: whereClause,
    with: {
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
          email: true,
        },
      },
      version: {
        columns: {
          id: true,
          version: true,
          name: true,
          fields: true,
        },
      },
    },
    orderBy: (submissions) => [sortFn(submissions[sortField as keyof typeof submissions])],
    limit,
    offset,
  })

  // Include form fields for context
  return {
    form: {
      id: form.id,
      name: form.name,
      fields: form.fields,
    },
    data: submissions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + submissions.length < total,
    },
  }
})
