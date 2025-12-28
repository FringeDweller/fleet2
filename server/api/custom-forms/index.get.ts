import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)

  // Filters
  const search = query.search as string | undefined
  const status = query.status as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'name'
  const sortOrder = (query.sortOrder as string) || 'asc'
  const validSortFields = ['name', 'status', 'createdAt', 'updatedAt']

  const conditions = [eq(schema.customForms.organisationId, session.user.organisationId)]

  if (status && ['draft', 'active', 'archived'].includes(status)) {
    conditions.push(eq(schema.customForms.status, status as 'draft' | 'active' | 'archived'))
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.customForms.name, `%${search}%`),
        ilike(schema.customForms.description, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customForms)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const forms = await db.query.customForms.findMany({
    where: whereClause,
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
    orderBy: (forms) => [sortFn(forms[sortField as keyof typeof forms])],
    limit,
    offset,
  })

  // Add field count to each form
  const formsWithFieldCount = forms.map((form) => ({
    ...form,
    fieldCount: form.fields?.length || 0,
  }))

  return {
    data: formsWithFieldCount,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + forms.length < total,
    },
  }
})
