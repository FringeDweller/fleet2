import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  // Filter by resolution status
  resolved: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    }),
  // Filter by discrepancy type
  type: z
    .enum([
      'quantity_mismatch',
      'amount_mismatch',
      'asset_mismatch',
      'unauthorized',
      'timing_mismatch',
      'multiple',
    ])
    .optional(),
  // Date range filters
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  // Pagination
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

/**
 * List fuel transactions with discrepancies
 *
 * GET /api/fuel/discrepancies
 *
 * Query parameters:
 * - resolved: Filter by resolution status (true/false)
 * - type: Filter by discrepancy type
 * - fromDate: Start of date range (ISO 8601)
 * - toDate: End of date range (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Requires: reports:read permission
 */
export default defineEventHandler(async (event) => {
  // Require reports:read permission
  const user = await requirePermission(event, 'reports:read')

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const params = result.data
  const offset = (params.page - 1) * params.limit

  // Build where conditions
  const conditions = [
    eq(schema.fuelTransactions.organisationId, user.organisationId),
    eq(schema.fuelTransactions.hasDiscrepancy, true),
  ]

  // Filter by resolution status
  if (params.resolved === true) {
    // Only resolved discrepancies
    conditions.push(
      // discrepancyResolvedAt is not null means it's resolved
      gte(schema.fuelTransactions.discrepancyResolvedAt, new Date(0)),
    )
  } else if (params.resolved === false) {
    // Only unresolved discrepancies
    conditions.push(isNull(schema.fuelTransactions.discrepancyResolvedAt))
  }

  // Filter by discrepancy type
  if (params.type) {
    conditions.push(eq(schema.fuelTransactions.discrepancyType, params.type))
  }

  // Filter by date range
  if (params.fromDate) {
    conditions.push(gte(schema.fuelTransactions.transactionDate, new Date(params.fromDate)))
  }
  if (params.toDate) {
    conditions.push(lte(schema.fuelTransactions.transactionDate, new Date(params.toDate)))
  }

  // Get discrepancies with related data
  const discrepancies = await db.query.fuelTransactions.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.fuelTransactions.transactionDate)],
    limit: params.limit,
    offset,
    with: {
      asset: true,
      user: true,
    },
  })

  // Get total count for pagination
  const allDiscrepancies = await db.query.fuelTransactions.findMany({
    where: and(...conditions),
    columns: { id: true },
  })
  const totalCount = allDiscrepancies.length

  // Get summary stats
  const unresolvedConditions = [
    eq(schema.fuelTransactions.organisationId, user.organisationId),
    eq(schema.fuelTransactions.hasDiscrepancy, true),
    isNull(schema.fuelTransactions.discrepancyResolvedAt),
  ]

  const unresolvedDiscrepancies = await db.query.fuelTransactions.findMany({
    where: and(...unresolvedConditions),
    columns: { id: true, discrepancyType: true },
  })

  // Count by type
  const byType = unresolvedDiscrepancies.reduce(
    (acc, d) => {
      const type = d.discrepancyType || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return {
    discrepancies: discrepancies.map((d) => ({
      id: d.id,
      transactionDate: d.transactionDate.toISOString(),
      quantity: Number.parseFloat(d.quantity),
      totalCost: d.totalCost ? Number.parseFloat(d.totalCost) : null,
      fuelType: d.fuelType,
      vendor: d.vendor,
      source: d.source,
      externalTransactionId: d.externalTransactionId,
      asset: d.asset
        ? {
            id: d.asset.id,
            assetNumber: d.asset.assetNumber,
            make: d.asset.make,
            model: d.asset.model,
          }
        : null,
      user: d.user
        ? {
            id: d.user.id,
            name: `${d.user.firstName} ${d.user.lastName}`,
            email: d.user.email,
          }
        : null,
      discrepancy: {
        type: d.discrepancyType,
        details: d.discrepancyDetails,
        resolved: d.discrepancyResolvedAt !== null,
        resolvedAt: d.discrepancyResolvedAt?.toISOString() || null,
        resolutionNotes: d.discrepancyResolutionNotes,
      },
      authorizationId: d.authorizationId,
      createdAt: d.createdAt.toISOString(),
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      totalCount,
      totalPages: Math.ceil(totalCount / params.limit),
      hasMore: offset + discrepancies.length < totalCount,
    },
    summary: {
      totalUnresolved: unresolvedDiscrepancies.length,
      byType,
    },
  }
})
