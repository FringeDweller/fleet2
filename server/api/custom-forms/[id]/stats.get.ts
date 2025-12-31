import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { CustomFormField } from '../../../db/schema/custom-forms'
import { db, schema } from '../../../utils/db'

interface DateRangeCount {
  date: string
  count: number
}

interface FieldStats {
  fieldId: string
  label: string
  fieldType: string
  distribution: Array<{
    value: string
    count: number
    percentage: number
  }>
  completionRate: number
}

interface FormStats {
  totalSubmissions: number
  statusBreakdown: Array<{
    status: string
    count: number
    percentage: number
  }>
  submissionsByDate: DateRangeCount[]
  completionRateOverall: number
  averageCompletionTime: number | null // in seconds
  fieldStats: FieldStats[]
}

/**
 * GET /api/custom-forms/:id/stats
 * Get analytics and statistics for a form
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

  // Date range filters
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Build base conditions
  const conditions = [
    eq(schema.customFormSubmissions.formId, formId),
    eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
  ]

  if (dateFrom) {
    conditions.push(gte(schema.customFormSubmissions.submittedAt, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.customFormSubmissions.submittedAt, new Date(dateTo)))
  }

  const whereClause = and(...conditions)

  // 1. Total submissions count
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormSubmissions)
    .where(whereClause)

  const totalSubmissions = totalResult[0]?.count || 0

  // 2. Status breakdown
  const statusResults = await db
    .select({
      status: schema.customFormSubmissions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.customFormSubmissions)
    .where(whereClause)
    .groupBy(schema.customFormSubmissions.status)

  const statusBreakdown = statusResults.map((r) => ({
    status: r.status,
    count: r.count,
    percentage: totalSubmissions > 0 ? Math.round((r.count / totalSubmissions) * 100) : 0,
  }))

  // 3. Submissions by date (last 30 days by default, or in range)
  const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endDate = dateTo ? new Date(dateTo) : new Date()

  const dateConditions = [
    eq(schema.customFormSubmissions.formId, formId),
    eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
    gte(schema.customFormSubmissions.submittedAt, startDate),
    lte(schema.customFormSubmissions.submittedAt, endDate),
  ]

  const dateResults = await db
    .select({
      date: sql<string>`to_char(${schema.customFormSubmissions.submittedAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.customFormSubmissions)
    .where(and(...dateConditions))
    .groupBy(sql`to_char(${schema.customFormSubmissions.submittedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.customFormSubmissions.submittedAt}, 'YYYY-MM-DD')`)

  const submissionsByDate = dateResults.map((r) => ({
    date: r.date!,
    count: r.count,
  }))

  // 4. Completion rate (submitted vs draft)
  const submittedCount = statusBreakdown.find((s) => s.status === 'submitted')?.count || 0
  const approvedCount = statusBreakdown.find((s) => s.status === 'approved')?.count || 0
  const draftCount = statusBreakdown.find((s) => s.status === 'draft')?.count || 0

  const completedCount = submittedCount + approvedCount
  const completionRateOverall =
    totalSubmissions > 0 ? Math.round((completedCount / totalSubmissions) * 100) : 0

  // 5. Average completion time (time between creation and submission)
  // This requires comparing createdAt and submittedAt
  const avgTimeResult = await db
    .select({
      avgSeconds: sql<number>`
        avg(
          EXTRACT(EPOCH FROM (${schema.customFormSubmissions.submittedAt} - ${schema.customFormSubmissions.createdAt}))
        )::numeric
      `,
    })
    .from(schema.customFormSubmissions)
    .where(
      and(
        ...conditions,
        // Only count non-draft submissions
        sql`${schema.customFormSubmissions.status} != 'draft'`,
      ),
    )

  const averageCompletionTime =
    avgTimeResult[0]?.avgSeconds !== null ? Math.round(avgTimeResult[0]!.avgSeconds) : null

  // 6. Field statistics (for dropdown, radio, multi-select, checkbox fields)
  const fields = (form.fields || []) as CustomFormField[]
  const analyzableFields = fields.filter((f) =>
    ['dropdown', 'radio', 'multi_select', 'checkbox'].includes(f.fieldType),
  )

  const fieldStats: FieldStats[] = []

  // Fetch all responses for field analysis
  if (analyzableFields.length > 0) {
    const allSubmissions = await db.query.customFormSubmissions.findMany({
      where: whereClause,
      columns: {
        responses: true,
      },
    })

    for (const field of analyzableFields) {
      const valueCounts: Record<string, number> = {}
      let filledCount = 0
      const totalCount = allSubmissions.length

      for (const submission of allSubmissions) {
        const value = submission.responses?.[field.id]

        if (value !== null && value !== undefined && value !== '') {
          filledCount++

          if (field.fieldType === 'checkbox') {
            // Boolean field
            const key = value ? 'Yes' : 'No'
            valueCounts[key] = (valueCounts[key] || 0) + 1
          } else if (Array.isArray(value)) {
            // Multi-select
            for (const v of value) {
              const strValue = String(v)
              valueCounts[strValue] = (valueCounts[strValue] || 0) + 1
            }
          } else {
            // Single value
            const strValue = String(value)
            valueCounts[strValue] = (valueCounts[strValue] || 0) + 1
          }
        }
      }

      // Build distribution array
      const distribution = Object.entries(valueCounts)
        .map(([value, count]) => ({
          value,
          count,
          percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 values

      fieldStats.push({
        fieldId: field.id,
        label: field.label,
        fieldType: field.fieldType,
        distribution,
        completionRate: totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0,
      })
    }
  }

  // 7. Top submitters
  const topSubmittersResult = await db
    .select({
      userId: schema.customFormSubmissions.submittedById,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.customFormSubmissions)
    .leftJoin(schema.users, eq(schema.customFormSubmissions.submittedById, schema.users.id))
    .where(whereClause)
    .groupBy(
      schema.customFormSubmissions.submittedById,
      schema.users.firstName,
      schema.users.lastName,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  const topSubmitters = topSubmittersResult.map((r) => ({
    userId: r.userId,
    name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : 'Unknown',
    count: r.count,
  }))

  const stats: FormStats & { topSubmitters: typeof topSubmitters } = {
    totalSubmissions,
    statusBreakdown,
    submissionsByDate,
    completionRateOverall,
    averageCompletionTime,
    fieldStats,
    topSubmitters,
  }

  return {
    form: {
      id: form.id,
      name: form.name,
      status: form.status,
      version: form.version,
    },
    stats,
    dateRange: {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    },
  }
})
