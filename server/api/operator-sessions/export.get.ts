import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission to export operator sessions
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)

  // Filters (same as listing endpoint)
  const assetId = query.assetId as string | undefined
  const operatorId = query.operatorId as string | undefined
  const status = query.status as 'active' | 'completed' | 'cancelled' | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const conditions = [eq(schema.operatorSessions.organisationId, user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.operatorSessions.assetId, assetId))
  }

  if (operatorId) {
    conditions.push(eq(schema.operatorSessions.operatorId, operatorId))
  }

  if (status && ['active', 'completed', 'cancelled'].includes(status)) {
    conditions.push(eq(schema.operatorSessions.status, status))
  }

  if (dateFrom) {
    conditions.push(gte(schema.operatorSessions.startTime, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.operatorSessions.startTime, new Date(dateTo)))
  }

  const whereClause = and(...conditions)

  const sessions = await db.query.operatorSessions.findMany({
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
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (sessions) => [asc(sessions.startTime)],
  })

  // Generate CSV
  const headers = [
    'Session ID',
    'Operator Name',
    'Asset Number',
    'Asset Make/Model',
    'Start Time',
    'End Time',
    'Start Odometer',
    'End Odometer',
    'Start Engine Hours',
    'End Engine Hours',
    'Trip Distance (km)',
    'Trip Duration (minutes)',
    'Duration',
    'Status',
    'Notes',
  ]

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const formatDuration = (minutes: number | null | undefined): string => {
    if (minutes === null || minutes === undefined) return ''
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const secs = 0 // Sessions store duration in minutes, no seconds precision
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const rows = sessions.map((session) =>
    [
      escapeCSV(session.id),
      escapeCSV(
        session.operator ? `${session.operator.firstName} ${session.operator.lastName}` : '',
      ),
      escapeCSV(session.asset?.assetNumber),
      escapeCSV(
        session.asset ? `${session.asset.make || ''} ${session.asset.model || ''}`.trim() : '',
      ),
      escapeCSV(session.startTime?.toISOString()),
      escapeCSV(session.endTime?.toISOString()),
      escapeCSV(session.startOdometer),
      escapeCSV(session.endOdometer),
      escapeCSV(session.startHours),
      escapeCSV(session.endHours),
      escapeCSV(session.tripDistance),
      escapeCSV(session.tripDurationMinutes),
      escapeCSV(formatDuration(session.tripDurationMinutes)),
      escapeCSV(session.status),
      escapeCSV(session.notes),
    ].join(','),
  )

  const csv = [headers.join(','), ...rows].join('\n')

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'export',
    entityType: 'operator_sessions',
    newValues: {
      count: sessions.length,
      filters: { assetId, operatorId, status, dateFrom, dateTo },
    },
  })

  // Set response headers for CSV download
  const dateStr = new Date().toISOString().split('T')[0]
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="operator-sessions-${dateStr}.csv"`)

  return csv
})
