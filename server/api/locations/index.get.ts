import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

/**
 * Query location records with filters
 *
 * Supports filtering by asset, operator session, and date range.
 * Returns paginated results.
 */

const querySchema = z.object({
  assetId: z.string().uuid().optional(),
  operatorSessionId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { assetId, operatorSessionId, startDate, endDate, page, limit } = result.data
  const offset = (page - 1) * limit

  // Build conditions
  const conditions = [eq(schema.locationRecords.organisationId, user.organisationId)]

  if (assetId) {
    conditions.push(eq(schema.locationRecords.assetId, assetId))
  }

  if (operatorSessionId) {
    conditions.push(eq(schema.locationRecords.operatorSessionId, operatorSessionId))
  }

  if (startDate) {
    conditions.push(gte(schema.locationRecords.recordedAt, new Date(startDate)))
  }

  if (endDate) {
    conditions.push(lte(schema.locationRecords.recordedAt, new Date(endDate)))
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.locationRecords)
    .where(and(...conditions))

  const total = countResult?.count ?? 0

  // Get records
  const records = await db
    .select({
      id: schema.locationRecords.id,
      assetId: schema.locationRecords.assetId,
      operatorSessionId: schema.locationRecords.operatorSessionId,
      latitude: schema.locationRecords.latitude,
      longitude: schema.locationRecords.longitude,
      accuracy: schema.locationRecords.accuracy,
      altitude: schema.locationRecords.altitude,
      speed: schema.locationRecords.speed,
      heading: schema.locationRecords.heading,
      recordedAt: schema.locationRecords.recordedAt,
      syncedAt: schema.locationRecords.syncedAt,
    })
    .from(schema.locationRecords)
    .where(and(...conditions))
    .orderBy(desc(schema.locationRecords.recordedAt))
    .limit(limit)
    .offset(offset)

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})
