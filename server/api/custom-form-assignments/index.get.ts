import { and, asc, desc, eq, sql } from 'drizzle-orm'
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
  const targetType = query.targetType as string | undefined
  const formId = query.formId as string | undefined
  const categoryId = query.categoryId as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'position'
  const sortOrder = (query.sortOrder as string) || 'asc'
  const validSortFields = ['position', 'targetType', 'createdAt', 'updatedAt']

  const conditions = [eq(schema.customFormAssignments.organisationId, session.user.organisationId)]

  if (targetType && ['asset', 'work_order', 'inspection', 'operator'].includes(targetType)) {
    conditions.push(
      eq(
        schema.customFormAssignments.targetType,
        targetType as 'asset' | 'work_order' | 'inspection' | 'operator',
      ),
    )
  }

  if (formId) {
    conditions.push(eq(schema.customFormAssignments.formId, formId))
  }

  if (categoryId) {
    conditions.push(eq(schema.customFormAssignments.categoryFilterId, categoryId))
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormAssignments)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'position'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const assignments = await db.query.customFormAssignments.findMany({
    where: whereClause,
    with: {
      form: {
        columns: {
          id: true,
          name: true,
          status: true,
        },
      },
      categoryFilter: {
        columns: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (assignments) => [sortFn(assignments[sortField as keyof typeof assignments])],
    limit,
    offset,
  })

  return {
    data: assignments,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + assignments.length < total,
    },
  }
})
