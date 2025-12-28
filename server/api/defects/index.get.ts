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
  const assetId = query.assetId as string | undefined
  const status = query.status as string | undefined
  const severity = query.severity as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'reportedAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = ['title', 'severity', 'status', 'reportedAt', 'updatedAt']

  const conditions = [eq(schema.defects.organisationId, session.user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.defects.assetId, assetId))
  }

  if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    conditions.push(
      eq(schema.defects.status, status as 'open' | 'in_progress' | 'resolved' | 'closed'),
    )
  }

  if (severity && ['minor', 'major', 'critical'].includes(severity)) {
    conditions.push(eq(schema.defects.severity, severity as 'minor' | 'major' | 'critical'))
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.defects.title, `%${search}%`),
        ilike(schema.defects.description, `%${search}%`),
        ilike(schema.defects.category, `%${search}%`),
        ilike(schema.defects.location, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.defects)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'reportedAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const defects = await db.query.defects.findMany({
    where: whereClause,
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      inspection: {
        columns: {
          id: true,
          status: true,
          completedAt: true,
        },
        with: {
          template: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      workOrder: {
        columns: {
          id: true,
          workOrderNumber: true,
          status: true,
        },
      },
      reportedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      resolvedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (defects) => [sortFn(defects[sortField as keyof typeof defects])],
    limit,
    offset,
  })

  return {
    data: defects,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + defects.length < total,
    },
  }
})
