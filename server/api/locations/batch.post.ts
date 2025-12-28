import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

/**
 * Batch upload location records from mobile devices
 *
 * Records are collected on the device during an operator session and synced
 * to the server when online. This endpoint handles batch inserts efficiently.
 *
 * @requirement REQ-1201-AC-04
 */

const locationRecordSchema = z.object({
  // Client-generated UUID for idempotency
  id: z.string().uuid().optional(),
  operatorSessionId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  altitude: z.number().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  recordedAt: z.string().datetime(),
})

const batchUploadSchema = z.object({
  assetId: z.string().uuid(),
  records: z.array(locationRecordSchema).min(1).max(100),
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
  const body = await readBody(event)
  const result = batchUploadSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, result.data.assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get all unique operator session IDs from the records
  const sessionIds = [...new Set(result.data.records.map((r) => r.operatorSessionId))]

  // Verify all operator sessions exist and belong to this asset
  const operatorSessions = await db.query.operatorSessions.findMany({
    where: and(
      eq(schema.operatorSessions.assetId, result.data.assetId),
      eq(schema.operatorSessions.organisationId, user.organisationId),
    ),
  })

  const validSessionIds = new Set(operatorSessions.map((s) => s.id))
  const invalidSessions = sessionIds.filter((id) => !validSessionIds.has(id))

  if (invalidSessions.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid operator session IDs',
      data: { invalidSessions },
    })
  }

  const now = new Date()

  // Prepare records for batch insert
  const recordsToInsert = result.data.records.map((record) => ({
    id: record.id,
    organisationId: user.organisationId,
    assetId: result.data.assetId,
    operatorSessionId: record.operatorSessionId,
    latitude: record.latitude.toFixed(7),
    longitude: record.longitude.toFixed(7),
    accuracy: record.accuracy?.toFixed(2) ?? null,
    altitude: record.altitude?.toFixed(2) ?? null,
    speed: record.speed?.toFixed(2) ?? null,
    heading: record.heading?.toFixed(2) ?? null,
    recordedAt: new Date(record.recordedAt),
    syncedAt: now,
  }))

  // Batch insert with ON CONFLICT DO NOTHING for idempotency
  const inserted = await db
    .insert(schema.locationRecords)
    .values(recordsToInsert)
    .onConflictDoNothing()
    .returning({ id: schema.locationRecords.id })

  // Update asset's last known location with the most recent record
  const mostRecent = result.data.records.reduce((latest, record) => {
    return new Date(record.recordedAt) > new Date(latest.recordedAt) ? record : latest
  })

  await db
    .update(schema.assets)
    .set({
      latitude: mostRecent.latitude.toFixed(7),
      longitude: mostRecent.longitude.toFixed(7),
      lastLocationUpdate: new Date(mostRecent.recordedAt),
      updatedAt: now,
    })
    .where(eq(schema.assets.id, result.data.assetId))

  return {
    success: true,
    inserted: inserted.length,
    total: result.data.records.length,
  }
})
