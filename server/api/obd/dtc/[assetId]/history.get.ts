/**
 * Get DTC history endpoint (US-10.3)
 *
 * Returns diagnostic code history for an asset with pagination and filtering.
 */

import { and, count, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'assetId')
  const query = getQuery(event)

  const limit = Math.min(parseInt(query.limit as string, 10) || 50, 100)
  const offset = parseInt(query.offset as string, 10) || 0
  const includeCleared = query.includeCleared !== 'false'

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Build where conditions
  const whereConditions = [eq(schema.diagnosticCodes.assetId, assetId)]
  if (!includeCleared) {
    whereConditions.push(isNull(schema.diagnosticCodes.clearedAt))
  }

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(schema.diagnosticCodes)
    .where(and(...whereConditions))

  const total = countResult?.count ?? 0

  // Get DTCs with pagination
  const codes = await db.query.diagnosticCodes.findMany({
    where: and(...whereConditions),
    with: {
      readByUser: {
        columns: { id: true, firstName: true, lastName: true },
      },
      clearedByUser: {
        columns: { id: true, firstName: true, lastName: true },
      },
      workOrder: {
        columns: { id: true, workOrderNumber: true, status: true },
      },
    },
    orderBy: (dc, { desc: descFn }) => [descFn(dc.readAt)],
    limit,
    offset,
  })

  // Calculate summary stats
  const summaryResult = await db
    .select({
      totalCodes: count(),
      activeCodes: sql<number>`count(*) filter (where ${schema.diagnosticCodes.clearedAt} is null)`,
      clearedCodes: sql<number>`count(*) filter (where ${schema.diagnosticCodes.clearedAt} is not null)`,
      criticalCount: sql<number>`count(*) filter (where ${schema.diagnosticCodes.severity} = 'critical' and ${schema.diagnosticCodes.clearedAt} is null)`,
      warningCount: sql<number>`count(*) filter (where ${schema.diagnosticCodes.severity} = 'warning' and ${schema.diagnosticCodes.clearedAt} is null)`,
      infoCount: sql<number>`count(*) filter (where ${schema.diagnosticCodes.severity} = 'info' and ${schema.diagnosticCodes.clearedAt} is null)`,
    })
    .from(schema.diagnosticCodes)
    .where(eq(schema.diagnosticCodes.assetId, assetId))

  const summary = summaryResult[0] ?? {
    totalCodes: 0,
    activeCodes: 0,
    clearedCodes: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
  }

  return {
    data: codes,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + codes.length < total,
    },
    summary: {
      totalCodes: Number(summary.totalCodes),
      activeCodes: Number(summary.activeCodes),
      clearedCodes: Number(summary.clearedCodes),
      criticalCount: Number(summary.criticalCount),
      warningCount: Number(summary.warningCount),
      infoCount: Number(summary.infoCount),
    },
  }
})
