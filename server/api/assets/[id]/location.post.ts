import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().max(255).optional(),
  locationAddress: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'gps', 'api', 'geofence']).default('manual'),
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
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  const body = await readBody(event)
  const result = locationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(eq(schema.assets.id, id), eq(schema.assets.organisationId, user.organisationId)),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const now = new Date()

  // Use a transaction to update both tables
  const [updatedAsset, historyEntry] = await db.transaction(async (tx) => {
    // Update asset with new location
    const [updated] = await tx
      .update(schema.assets)
      .set({
        latitude: result.data.latitude.toFixed(7),
        longitude: result.data.longitude.toFixed(7),
        locationName: result.data.locationName || null,
        locationAddress: result.data.locationAddress || null,
        lastLocationUpdate: now,
        updatedAt: now,
      })
      .where(eq(schema.assets.id, id))
      .returning()

    // Create location history entry
    const [history] = await tx
      .insert(schema.assetLocationHistory)
      .values({
        assetId: id,
        latitude: result.data.latitude.toFixed(7),
        longitude: result.data.longitude.toFixed(7),
        locationName: result.data.locationName || null,
        locationAddress: result.data.locationAddress || null,
        updatedById: user.id,
        notes: result.data.notes || null,
        source: result.data.source,
        recordedAt: now,
      })
      .returning()

    return [updated, history]
  })

  if (!updatedAsset) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update asset location',
    })
  }

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'location_update',
    entityType: 'asset',
    entityId: id,
    oldValues: {
      latitude: asset.latitude,
      longitude: asset.longitude,
      locationName: asset.locationName,
    },
    newValues: {
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      locationName: result.data.locationName,
    },
  })

  return {
    asset: {
      id: updatedAsset.id,
      latitude: updatedAsset.latitude,
      longitude: updatedAsset.longitude,
      locationName: updatedAsset.locationName,
      locationAddress: updatedAsset.locationAddress,
      lastLocationUpdate: updatedAsset.lastLocationUpdate,
    },
    historyEntry,
  }
})
