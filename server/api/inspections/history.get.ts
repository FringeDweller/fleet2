import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission for viewing inspections
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filters
  const search = query.search as string | undefined
  const assetId = query.assetId as string | undefined
  const operatorId = query.operatorId as string | undefined
  const status = query.status as string | undefined
  const templateId = query.templateId as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const overallResult = query.overallResult as string | undefined

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Sorting
  const sortBy = (query.sortBy as string) || 'startedAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = ['startedAt', 'completedAt', 'status', 'overallResult', 'createdAt']

  const conditions = [eq(schema.inspections.organisationId, user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.inspections.assetId, assetId))
  }

  if (operatorId) {
    conditions.push(eq(schema.inspections.operatorId, operatorId))
  }

  if (status && ['in_progress', 'completed', 'cancelled'].includes(status)) {
    conditions.push(
      eq(schema.inspections.status, status as 'in_progress' | 'completed' | 'cancelled'),
    )
  }

  if (templateId) {
    conditions.push(eq(schema.inspections.templateId, templateId))
  }

  if (startDate) {
    const parsedStartDate = new Date(startDate)
    if (!Number.isNaN(parsedStartDate.getTime())) {
      conditions.push(gte(schema.inspections.startedAt, parsedStartDate))
    }
  }

  if (endDate) {
    const parsedEndDate = new Date(endDate)
    if (!Number.isNaN(parsedEndDate.getTime())) {
      // Set to end of day
      parsedEndDate.setHours(23, 59, 59, 999)
      conditions.push(lte(schema.inspections.startedAt, parsedEndDate))
    }
  }

  if (overallResult && ['pass', 'fail'].includes(overallResult)) {
    conditions.push(eq(schema.inspections.overallResult, overallResult))
  }

  // Global search
  if (search) {
    conditions.push(
      or(
        ilike(schema.inspections.notes, `%${search}%`),
        ilike(schema.inspections.locationName, `%${search}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.inspections)
    .where(whereClause)

  const total = countResult[0]?.count || 0

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'startedAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  const inspections = await db.query.inspections.findMany({
    where: whereClause,
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
        },
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      template: {
        columns: {
          id: true,
          name: true,
          description: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      signedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        columns: {
          id: true,
          result: true,
        },
      },
    },
    orderBy: (inspections) => [sortFn(inspections[sortField as keyof typeof inspections])],
    limit,
    offset,
  })

  // Calculate item summary for each inspection
  const inspectionsWithSummary = inspections.map((inspection) => {
    const items = inspection.items || []
    const summary = {
      total: items.length,
      passed: items.filter((i) => i.result === 'pass').length,
      failed: items.filter((i) => i.result === 'fail').length,
      na: items.filter((i) => i.result === 'na').length,
      pending: items.filter((i) => i.result === 'pending').length,
    }

    // Remove items array and return summary instead
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { items: _, ...rest } = inspection
    return {
      ...rest,
      itemsSummary: summary,
    }
  })

  return {
    data: inspectionsWithSummary,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + inspections.length < total,
    },
  }
})
