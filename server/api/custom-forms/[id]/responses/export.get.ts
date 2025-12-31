import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { CustomFormField } from '../../../../db/schema/custom-forms'
import { db, schema } from '../../../../utils/db'

/**
 * GET /api/custom-forms/:id/responses/export
 * Export form submissions as CSV
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

  // Format: 'csv' (default)
  const format = (query.format as string) || 'csv'

  // Filters
  const status = query.status as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const contextType = query.contextType as string | undefined
  const contextId = query.contextId as string | undefined

  // Field value filters
  const fieldFilters = query.fieldFilters as string | undefined
  let parsedFieldFilters: Record<string, unknown> | undefined
  if (fieldFilters) {
    try {
      parsedFieldFilters = JSON.parse(fieldFilters)
    } catch {
      // Ignore invalid JSON
    }
  }

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

  // Apply field value filters
  if (parsedFieldFilters && Object.keys(parsedFieldFilters).length > 0) {
    for (const [fieldId, value] of Object.entries(parsedFieldFilters)) {
      const jsonCondition = sql`${schema.customFormSubmissions.responses}->>${fieldId} = ${String(value)}`
      conditions.push(jsonCondition)
    }
  }

  const whereClause = and(...conditions)

  // Fetch all matching submissions
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
      version: {
        columns: {
          id: true,
          version: true,
          fields: true,
        },
      },
    },
    orderBy: (submissions) => [desc(submissions.submittedAt)],
  })

  // Get all unique field IDs from form fields (exclude section headers)
  const fields = (form.fields || []).filter(
    (f: CustomFormField) => f.fieldType !== 'section',
  ) as CustomFormField[]

  if (format === 'csv') {
    // Build CSV headers
    const staticHeaders = [
      'Submission ID',
      'Status',
      'Submitted At',
      'Submitted By',
      'Submitter Email',
      'Version',
      'Context Type',
      'Context ID',
      'Notes',
    ]

    const fieldHeaders = fields.map((f) => f.label)
    const allHeaders = [...staticHeaders, ...fieldHeaders]

    // Build CSV rows
    const rows: string[][] = []

    for (const submission of submissions) {
      const row: string[] = [
        submission.id,
        submission.status,
        submission.submittedAt?.toISOString() || '',
        submission.submittedBy
          ? `${submission.submittedBy.firstName} ${submission.submittedBy.lastName}`
          : '',
        submission.submittedBy?.email || '',
        submission.version?.version?.toString() || '',
        submission.contextType || '',
        submission.contextId || '',
        submission.submitterNotes || '',
      ]

      // Add field values
      for (const field of fields) {
        const value = submission.responses?.[field.id]
        row.push(formatFieldValueForCsv(value, field))
      }

      rows.push(row)
    }

    // Generate CSV content
    const csvContent = generateCsv(allHeaders, rows)

    // Set response headers for file download
    const filename = `${form.name.replace(/[^a-zA-Z0-9]/g, '_')}_responses_${new Date().toISOString().split('T')[0]}.csv`

    setHeaders(event, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })

    return csvContent
  }

  // Default to JSON if format not supported
  throw createError({
    statusCode: 400,
    statusMessage: 'Unsupported export format. Use format=csv',
  })
})

/**
 * Format a field value for CSV output
 */
function formatFieldValueForCsv(value: unknown, _field: CustomFormField): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Handle arrays (multi-select)
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join('; ')
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  // Handle objects (location, file info, etc.)
  if (typeof value === 'object') {
    // Location fields
    if ('latitude' in value && 'longitude' in value) {
      const loc = value as { latitude: number; longitude: number }
      return `${loc.latitude}, ${loc.longitude}`
    }

    // File/photo fields
    if ('url' in value) {
      return (value as { url: string }).url
    }

    // Default to JSON string
    return JSON.stringify(value)
  }

  return String(value)
}

/**
 * Generate CSV content with proper escaping
 */
function generateCsv(headers: string[], rows: string[][]): string {
  const escapeCsvValue = (str: string): string => {
    // If contains comma, newline, or quote, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.map(escapeCsvValue).join(',')
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','))

  return [headerLine, ...dataLines].join('\n')
}
