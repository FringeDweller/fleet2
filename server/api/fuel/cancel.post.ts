import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { markAsCancelled } from '../../utils/fuel-auth'
import { requireAuth } from '../../utils/permissions'

const cancelSchema = z.object({
  // Auth code of authorization to cancel
  authCode: z.string().min(1, 'Auth code is required').max(10),
  // Optional reason for cancellation
  reason: z.string().max(500).optional().nullable(),
})

/**
 * Cancel a fuel authorization
 * Can be called by the operator who created it or by admin
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = cancelSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { authCode, reason } = result.data

  // Find the authorization
  const authorization = await db.query.fuelAuthorizations.findFirst({
    where: and(
      eq(schema.fuelAuthorizations.authCode, authCode.toUpperCase()),
      eq(schema.fuelAuthorizations.organisationId, user.organisationId),
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

  if (!authorization) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Authorization not found',
    })
  }

  // Check if user can cancel (must be the operator who created it or an admin)
  const isOwner = authorization.operatorId === user.id
  const isAdmin = user.permissions.includes('*') || user.permissions.includes('**')

  if (!isOwner && !isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only cancel your own fuel authorizations',
    })
  }

  // Check if it can be cancelled
  if (authorization.status === 'completed') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot cancel a completed authorization',
      data: {
        code: 'ALREADY_COMPLETED',
      },
    })
  }

  if (authorization.status === 'cancelled') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Authorization is already cancelled',
      data: {
        code: 'ALREADY_CANCELLED',
      },
    })
  }

  if (authorization.status === 'expired') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot cancel an expired authorization',
      data: {
        code: 'ALREADY_EXPIRED',
      },
    })
  }

  // Cancel the authorization
  await markAsCancelled(authorization.id)

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'fuel_authorization_cancelled',
    entityType: 'fuel_authorization',
    entityId: authorization.id,
    newValues: {
      authCode,
      cancelledBy: user.id,
      reason,
    },
  })

  return {
    success: true,
    authorization: {
      id: authorization.id,
      authCode: authorization.authCode,
      status: 'cancelled',
    },
    asset: {
      id: authorization.asset.id,
      assetNumber: authorization.asset.assetNumber,
    },
    message: `Fuel authorization ${authCode} has been cancelled.`,
  }
})
