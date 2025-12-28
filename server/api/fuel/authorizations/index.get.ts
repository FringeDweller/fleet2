import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const querySchema = z.object({
  // Filter by status
  status: z
    .enum(['pending', 'authorized', 'completed', 'cancelled', 'expired'])
    .optional()
    .or(
      z
        .string()
        .transform(
          (s) =>
            s.split(',') as Array<'pending' | 'authorized' | 'completed' | 'cancelled' | 'expired'>,
        ),
    ),
  // Filter by asset
  assetId: z.string().uuid().optional(),
  // Filter by operator
  operatorId: z.string().uuid().optional(),
  // Filter by date range
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

/**
 * List fuel authorizations with filtering and pagination
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const filters = result.data
  const offset = (filters.page - 1) * filters.limit

  // Build where conditions
  const conditions = [eq(schema.fuelAuthorizations.organisationId, user.organisationId)]

  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(schema.fuelAuthorizations.status, filters.status))
    } else {
      conditions.push(eq(schema.fuelAuthorizations.status, filters.status))
    }
  }

  // Asset filter
  if (filters.assetId) {
    conditions.push(eq(schema.fuelAuthorizations.assetId, filters.assetId))
  }

  // Operator filter
  if (filters.operatorId) {
    conditions.push(eq(schema.fuelAuthorizations.operatorId, filters.operatorId))
  }

  // Date range filter
  if (filters.fromDate) {
    conditions.push(gte(schema.fuelAuthorizations.requestedAt, new Date(filters.fromDate)))
  }
  if (filters.toDate) {
    conditions.push(lte(schema.fuelAuthorizations.requestedAt, new Date(filters.toDate)))
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.fuelAuthorizations)
    .where(and(...conditions))

  const total = countResult[0]?.count || 0

  // Get authorizations with relations
  const authorizations = await db.query.fuelAuthorizations.findMany({
    where: and(...conditions),
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
          email: true,
        },
      },
      fuelTransaction: {
        columns: {
          id: true,
          quantity: true,
          totalCost: true,
          transactionDate: true,
        },
      },
    },
    orderBy: [desc(schema.fuelAuthorizations.requestedAt)],
    limit: filters.limit,
    offset,
  })

  return {
    data: authorizations.map((auth) => ({
      id: auth.id,
      authCode: auth.authCode,
      status: auth.status,
      maxQuantityLitres: auth.maxQuantityLitres,
      maxAmountDollars: auth.maxAmountDollars,
      requestedAt: auth.requestedAt.toISOString(),
      authorizedAt: auth.authorizedAt?.toISOString() || null,
      expiresAt: auth.expiresAt.toISOString(),
      completedAt: auth.completedAt?.toISOString() || null,
      cancelledAt: auth.cancelledAt?.toISOString() || null,
      asset: {
        id: auth.asset.id,
        assetNumber: auth.asset.assetNumber,
        make: auth.asset.make,
        model: auth.asset.model,
      },
      operator: {
        id: auth.operator.id,
        name: `${auth.operator.firstName} ${auth.operator.lastName}`,
        email: auth.operator.email,
      },
      fuelTransaction: auth.fuelTransaction
        ? {
            id: auth.fuelTransaction.id,
            quantity: auth.fuelTransaction.quantity,
            totalCost: auth.fuelTransaction.totalCost,
            transactionDate: auth.fuelTransaction.transactionDate.toISOString(),
          }
        : null,
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  }
})
