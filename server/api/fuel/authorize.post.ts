import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import {
  calculateExpiryTime,
  DEFAULT_AUTH_EXPIRY_MINUTES,
  generateQRCodeData,
  generateUniqueAuthCode,
} from '../../utils/fuel-auth'
import { requireAuth } from '../../utils/permissions'

const authorizeSchema = z.object({
  // Asset to fuel (must have active operator session)
  assetId: z.string().uuid('Invalid asset ID'),
  // Optional pre-authorization limits
  maxQuantityLitres: z.number().positive().optional().nullable(),
  maxAmountDollars: z.number().positive().optional().nullable(),
  // Optional custom expiry in minutes (default 30, max 60)
  expiryMinutes: z.number().min(5).max(60).optional().default(DEFAULT_AUTH_EXPIRY_MINUTES),
})

export default defineEventHandler(async (event) => {
  // Require authenticated operator
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = authorizeSchema.safeParse(body)

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
    columns: {
      id: true,
      assetNumber: true,
      make: true,
      model: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Find active operator session for this user on this asset
  const operatorSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.assetId, data.assetId),
      eq(schema.operatorSessions.operatorId, user.id),
      eq(schema.operatorSessions.status, 'active'),
    ),
  })

  if (!operatorSession) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You must be logged onto this asset to request fuel authorization',
      data: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active operator session found for this asset',
      },
    })
  }

  // Check for existing pending/authorized authorization for this session
  const existingAuth = await db.query.fuelAuthorizations.findFirst({
    where: and(
      eq(schema.fuelAuthorizations.operatorSessionId, operatorSession.id),
      eq(schema.fuelAuthorizations.status, 'pending'),
    ),
  })

  if (existingAuth) {
    // Check if it's still valid
    if (new Date() < existingAuth.expiresAt) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You already have a pending fuel authorization',
        data: {
          code: 'EXISTING_AUTHORIZATION',
          authorizationId: existingAuth.id,
          authCode: existingAuth.authCode,
          expiresAt: existingAuth.expiresAt.toISOString(),
        },
      })
    }
    // If expired, mark it as expired
    await db
      .update(schema.fuelAuthorizations)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(schema.fuelAuthorizations.id, existingAuth.id))
  }

  // Generate unique auth code
  const authCode = await generateUniqueAuthCode()
  const expiresAt = calculateExpiryTime(data.expiryMinutes)
  const operatorName = `${user.firstName} ${user.lastName}`

  // Generate QR code data
  const qrCodeData = generateQRCodeData(
    authCode,
    asset.id,
    asset.assetNumber,
    operatorName,
    user.organisationId,
    expiresAt,
    data.maxQuantityLitres?.toString(),
    data.maxAmountDollars?.toString(),
  )

  // Create authorization record
  const authorizationResult = await db.transaction(async (tx) => {
    const [authorization] = await tx
      .insert(schema.fuelAuthorizations)
      .values({
        organisationId: user.organisationId,
        assetId: data.assetId,
        operatorSessionId: operatorSession.id,
        operatorId: user.id,
        authCode,
        qrCodeData,
        status: 'pending',
        maxQuantityLitres: data.maxQuantityLitres?.toString() ?? null,
        maxAmountDollars: data.maxAmountDollars?.toString() ?? null,
        expiresAt,
      })
      .returning()

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'fuel_authorization_requested',
      entityType: 'fuel_authorization',
      entityId: authorization!.id,
      newValues: {
        assetId: data.assetId,
        assetNumber: asset.assetNumber,
        authCode,
        expiresAt: expiresAt.toISOString(),
        maxQuantityLitres: data.maxQuantityLitres,
        maxAmountDollars: data.maxAmountDollars,
      },
    })

    return authorization!
  })

  return {
    authorization: {
      id: authorizationResult.id,
      authCode: authorizationResult.authCode,
      qrCodeData: authorizationResult.qrCodeData,
      status: authorizationResult.status,
      expiresAt: authorizationResult.expiresAt.toISOString(),
      maxQuantityLitres: authorizationResult.maxQuantityLitres,
      maxAmountDollars: authorizationResult.maxAmountDollars,
    },
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
    },
    operator: {
      id: user.id,
      name: operatorName,
    },
    message: `Fuel authorization created. Code: ${authCode}. Valid for ${data.expiryMinutes} minutes.`,
  }
})
