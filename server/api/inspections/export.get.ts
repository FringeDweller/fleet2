import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require reports:read permission for exporting
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)

  // Filters
  const assetId = query.assetId as string | undefined
  const operatorId = query.operatorId as string | undefined
  const status = query.status as string | undefined
  const templateId = query.templateId as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const overallResult = query.overallResult as string | undefined

  // Format (csv or json)
  const format = (query.format as string) || 'csv'

  // Sorting
  const sortBy = (query.sortBy as string) || 'startedAt'
  const sortOrder = (query.sortOrder as string) || 'desc'
  const validSortFields = ['startedAt', 'completedAt', 'status', 'overallResult']

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
      parsedEndDate.setHours(23, 59, 59, 999)
      conditions.push(lte(schema.inspections.startedAt, parsedEndDate))
    }
  }

  if (overallResult && ['pass', 'fail'].includes(overallResult)) {
    conditions.push(eq(schema.inspections.overallResult, overallResult))
  }

  const whereClause = and(...conditions)

  // Build sort
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'startedAt'
  const sortFn = sortOrder === 'asc' ? asc : desc

  // Limit export to 5000 records for performance
  const inspections = await db.query.inspections.findMany({
    where: whereClause,
    with: {
      asset: {
        columns: {
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
        },
      },
      template: {
        columns: {
          name: true,
        },
      },
      operator: {
        columns: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      signedBy: {
        columns: {
          firstName: true,
          lastName: true,
        },
      },
      items: {
        columns: {
          id: true,
          checklistItemLabel: true,
          result: true,
          notes: true,
        },
      },
    },
    orderBy: (inspections) => [sortFn(inspections[sortField as keyof typeof inspections])],
    limit: 5000,
  })

  // Calculate summary for each inspection
  const exportData = inspections.map((inspection) => {
    const items = inspection.items || []
    const passedItems = items.filter((i) => i.result === 'pass').length
    const failedItems = items.filter((i) => i.result === 'fail').length
    const naItems = items.filter((i) => i.result === 'na').length

    return {
      inspectionId: inspection.id,
      assetNumber: inspection.asset?.assetNumber || '',
      assetMake: inspection.asset?.make || '',
      assetModel: inspection.asset?.model || '',
      assetYear: inspection.asset?.year || '',
      licensePlate: inspection.asset?.licensePlate || '',
      templateName: inspection.template?.name || '',
      operatorName: inspection.operator
        ? `${inspection.operator.firstName} ${inspection.operator.lastName}`
        : '',
      operatorEmail: inspection.operator?.email || '',
      status: inspection.status,
      overallResult: inspection.overallResult || '',
      startedAt: inspection.startedAt?.toISOString() || '',
      completedAt: inspection.completedAt?.toISOString() || '',
      initiationMethod: inspection.initiationMethod,
      locationName: inspection.locationName || '',
      latitude: inspection.latitude || '',
      longitude: inspection.longitude || '',
      totalItems: items.length,
      passedItems,
      failedItems,
      naItems,
      signedBy: inspection.signedBy
        ? `${inspection.signedBy.firstName} ${inspection.signedBy.lastName}`
        : '',
      signedAt: inspection.signedAt?.toISOString() || '',
      notes: inspection.notes || '',
    }
  })

  if (format === 'json') {
    return {
      exportedAt: new Date().toISOString(),
      totalRecords: exportData.length,
      data: exportData,
    }
  }

  // Generate CSV
  const headers = [
    'Inspection ID',
    'Asset Number',
    'Make',
    'Model',
    'Year',
    'License Plate',
    'Template Name',
    'Operator Name',
    'Operator Email',
    'Status',
    'Overall Result',
    'Started At',
    'Completed At',
    'Initiation Method',
    'Location',
    'Latitude',
    'Longitude',
    'Total Items',
    'Passed Items',
    'Failed Items',
    'N/A Items',
    'Signed By',
    'Signed At',
    'Notes',
  ]

  const csvRows = [headers.join(',')]

  for (const row of exportData) {
    const values = [
      escapeCSV(row.inspectionId),
      escapeCSV(row.assetNumber),
      escapeCSV(row.assetMake),
      escapeCSV(row.assetModel),
      escapeCSV(String(row.assetYear)),
      escapeCSV(row.licensePlate),
      escapeCSV(row.templateName),
      escapeCSV(row.operatorName),
      escapeCSV(row.operatorEmail),
      escapeCSV(row.status),
      escapeCSV(row.overallResult),
      escapeCSV(row.startedAt),
      escapeCSV(row.completedAt),
      escapeCSV(row.initiationMethod),
      escapeCSV(row.locationName),
      escapeCSV(String(row.latitude)),
      escapeCSV(String(row.longitude)),
      escapeCSV(String(row.totalItems)),
      escapeCSV(String(row.passedItems)),
      escapeCSV(String(row.failedItems)),
      escapeCSV(String(row.naItems)),
      escapeCSV(row.signedBy),
      escapeCSV(row.signedAt),
      escapeCSV(row.notes),
    ]
    csvRows.push(values.join(','))
  }

  const csv = csvRows.join('\n')

  // Set response headers for CSV download
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="inspection-history-${new Date().toISOString().split('T')[0]}.csv"`,
  )

  return csv
})

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string): string {
  if (value === null || value === undefined) {
    return ''
  }
  // If value contains comma, newline, or quote, wrap in quotes and escape existing quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
