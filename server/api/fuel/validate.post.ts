import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { markAsAuthorized, validateAuthorization } from '../../utils/fuel-auth'

const validateSchema = z.object({
  // Auth code from NFC/QR scan
  authCode: z.string().min(1, 'Auth code is required').max(10),
})

/**
 * Validate fuel authorization at bowser/pump
 * This endpoint is called by the bowser system after NFC tap or QR scan
 *
 * Returns asset and operator info if valid, marks as authorized
 */
export default defineEventHandler(async (event) => {
  // Note: This endpoint may be called by bowser equipment with API key auth
  // For now, we'll allow unauthenticated access but verify the auth code
  // In production, add API key validation for bowser equipment

  const body = await readBody(event)
  const result = validateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { authCode } = result.data

  // Validate the authorization
  const validationResult = await validateAuthorization(authCode)

  if (!validationResult.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: validationResult.error || 'Invalid authorization',
      data: {
        code: validationResult.errorCode,
        message: validationResult.error,
      },
    })
  }

  const authorization = validationResult.authorization!

  // Mark as authorized (if it was pending)
  if (authorization.status === 'pending') {
    await markAsAuthorized(authorization.id)

    // Log audit entry
    await db.insert(schema.auditLog).values({
      organisationId: authorization.organisationId,
      userId: authorization.operatorId,
      action: 'fuel_authorization_validated',
      entityType: 'fuel_authorization',
      entityId: authorization.id,
      newValues: {
        authCode,
        validatedAt: new Date().toISOString(),
      },
    })
  }

  return {
    valid: true,
    authorization: {
      id: authorization.id,
      authCode: authorization.authCode,
      status: 'authorized',
      maxQuantityLitres: authorization.maxQuantityLitres,
      maxAmountDollars: authorization.maxAmountDollars,
      expiresAt: authorization.expiresAt.toISOString(),
    },
    asset: {
      id: authorization.asset.id,
      assetNumber: authorization.asset.assetNumber,
      make: authorization.asset.make,
      model: authorization.asset.model,
    },
    operator: {
      id: authorization.operator.id,
      name: `${authorization.operator.firstName} ${authorization.operator.lastName}`,
      email: authorization.operator.email,
    },
    session: {
      id: authorization.operatorSession.id,
      startTime: authorization.operatorSession.startTime.toISOString(),
    },
  }
})
