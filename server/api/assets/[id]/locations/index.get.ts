import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

/**
 * Get location history for a specific asset
 *
 * Returns GPS location records captured during operator sessions.
 * Supports filtering by date range.
 */

const querySchema = z.object({
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
  const assetId = getRouterParam(event, 'id')

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
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { startDate, endDate, page, limit } = result.data
  const offset = (page - 1) * limit

  // Build conditions
  const conditions = [eq(schema.locationRecords.assetId, assetId)]

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

  // Get records with operator session info
  const records = await db
    .select({
      id: schema.locationRecords.id,
      operatorSessionId: schema.locationRecords.operatorSessionId,
      latitude: schema.locationRecords.latitude,
      longitude: schema.locationRecords.longitude,
      accuracy: schema.locationRecords.accuracy,
      altitude: schema.locationRecords.altitude,
      speed: schema.locationRecords.speed,
      heading: schema.locationRecords.heading,
      recordedAt: schema.locationRecords.recordedAt,
    })
    .from(schema.locationRecords)
    .where(and(...conditions))
    .orderBy(desc(schema.locationRecords.recordedAt))
    .limit(limit)
    .offset(offset)

  return {
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
    },
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})
