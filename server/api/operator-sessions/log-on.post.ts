import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

const logOnSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  startOdometer: z.number().min(0).optional().nullable(),
  startHours: z.number().min(0).optional().nullable(),
  startLatitude: z.number().min(-90).max(90).optional().nullable(),
  startLongitude: z.number().min(-180).max(180).optional().nullable(),
  startLocationName: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // For offline sync support
  syncStatus: z.enum(['synced', 'pending', 'failed']).optional().default('synced'),
  // Allow passing a custom start time for offline sessions
  startTime: z.string().datetime().optional(),
})

export default defineEventHandler(async (event) => {
  // Require authenticated user
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = logOnSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, data.assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Check if asset already has an active session
  const existingAssetSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.assetId, data.assetId),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (existingAssetSession) {
    throw createError({
      statusCode: 409,
      statusMessage: `This asset is already in use by ${existingAssetSession.operator.firstName} ${existingAssetSession.operator.lastName}`,
      data: {
        existingSessionId: existingAssetSession.id,
        operatorName: `${existingAssetSession.operator.firstName} ${existingAssetSession.operator.lastName}`,
      },
    })
  }

  // Check if operator already has an active session on any asset
  const existingOperatorSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.operatorId, user.id),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
        },
      },
    },
  })

  if (existingOperatorSession) {
    throw createError({
      statusCode: 409,
      statusMessage: `You already have an active session on asset ${existingOperatorSession.asset.assetNumber}`,
      data: {
        existingSessionId: existingOperatorSession.id,
        assetId: existingOperatorSession.assetId,
        assetNumber: existingOperatorSession.asset.assetNumber,
      },
    })
  }

  // Create new operator session
  const sessionResult = await db.transaction(async (tx) => {
    const [newSession] = await tx
      .insert(schema.operatorSessions)
      .values({
        organisationId: user.organisationId,
        assetId: data.assetId,
        operatorId: user.id,
        startTime: data.startTime ? new Date(data.startTime) : new Date(),
        startOdometer: data.startOdometer?.toString() ?? null,
        startHours: data.startHours?.toString() ?? null,
        startLatitude: data.startLatitude?.toString() ?? null,
        startLongitude: data.startLongitude?.toString() ?? null,
        startLocationName: data.startLocationName ?? null,
        notes: data.notes ?? null,
        status: 'active',
        syncStatus: data.syncStatus,
      })
      .returning()

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'operator_log_on',
      entityType: 'operator_session',
      entityId: newSession!.id,
      newValues: {
        assetId: data.assetId,
        assetNumber: asset.assetNumber,
        startOdometer: data.startOdometer,
        startHours: data.startHours,
        startLatitude: data.startLatitude,
        startLongitude: data.startLongitude,
        startLocationName: data.startLocationName,
      },
    })

    // Optionally update asset location if GPS coordinates provided
    if (data.startLatitude && data.startLongitude) {
      await tx
        .update(schema.assets)
        .set({
          latitude: data.startLatitude.toString(),
          longitude: data.startLongitude.toString(),
          locationName: data.startLocationName ?? undefined,
          lastLocationUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.assets.id, data.assetId))

      // Add to location history
      await tx.insert(schema.assetLocationHistory).values({
        assetId: data.assetId,
        latitude: data.startLatitude.toString(),
        longitude: data.startLongitude.toString(),
        locationName: data.startLocationName ?? null,
        source: 'operator_log_on',
        updatedById: user.id,
        recordedAt: new Date(),
      })
    }

    return newSession!
  })

  // Fetch the session with relations
  const session = await db.query.operatorSessions.findFirst({
    where: eq(schema.operatorSessions.id, sessionResult.id),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          imageUrl: true,
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
    },
  })

  return {
    session,
    message: `Successfully logged on to asset ${asset.assetNumber}`,
  }
})
