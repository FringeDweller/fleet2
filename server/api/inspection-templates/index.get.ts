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
  const categoryId = query.categoryId as string | undefined
  const isActive = query.isActive as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'name'
  const sortOrder = (query.sortOrder as string) || 'asc'
  const validSortFields = ['name', 'createdAt', 'updatedAt']

  const conditions = [eq(schema.inspectionTemplates.organisationId, session.user.organisationId)]

  if (categoryId) {
    conditions.push(eq(schema.inspectionTemplates.categoryId, categoryId))
  }

  if (isActive !== undefined) {
    conditions.push(eq(schema.inspectionTemplates.isActive, isActive === 'true'))
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.inspectionTemplates.name, `%${search}%`),
        ilike(schema.inspectionTemplates.description, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.inspectionTemplates)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const templates = await db.query.inspectionTemplates.findMany({
    where: whereClause,
    with: {
      category: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: (templates) => [sortFn(templates[sortField as keyof typeof templates])],
    limit,
    offset,
  })

  return {
    data: templates,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + templates.length < total,
    },
  }
})
