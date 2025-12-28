import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid authorization ID'),
})

/**
 * Get fuel authorization details by ID
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const params = event.context.params
  const result = paramsSchema.safeParse(params)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { id } = result.data

  // Get authorization with full relations
  const authorization = await db.query.fuelAuthorizations.findFirst({
    where: and(
      eq(schema.fuelAuthorizations.id, id),
      eq(schema.fuelAuthorizations.organisationId, user.organisationId),
    ),
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
          phone: true,
          avatarUrl: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          startOdometer: true,
          startHours: true,
        },
      },
      fuelTransaction: true,
    },
  })

  if (!authorization) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Authorization not found',
    })
  }

  return {
    id: authorization.id,
    authCode: authorization.authCode,
    qrCodeData: authorization.qrCodeData,
    status: authorization.status,
    maxQuantityLitres: authorization.maxQuantityLitres,
    maxAmountDollars: authorization.maxAmountDollars,
    requestedAt: authorization.requestedAt.toISOString(),
    authorizedAt: authorization.authorizedAt?.toISOString() || null,
    expiresAt: authorization.expiresAt.toISOString(),
    completedAt: authorization.completedAt?.toISOString() || null,
    cancelledAt: authorization.cancelledAt?.toISOString() || null,
    createdAt: authorization.createdAt.toISOString(),
    updatedAt: authorization.updatedAt.toISOString(),
    asset: {
      id: authorization.asset.id,
      assetNumber: authorization.asset.assetNumber,
      make: authorization.asset.make,
      model: authorization.asset.model,
      year: authorization.asset.year,
      licensePlate: authorization.asset.licensePlate,
      imageUrl: authorization.asset.imageUrl,
    },
    operator: {
      id: authorization.operator.id,
      firstName: authorization.operator.firstName,
      lastName: authorization.operator.lastName,
      name: `${authorization.operator.firstName} ${authorization.operator.lastName}`,
      email: authorization.operator.email,
      phone: authorization.operator.phone,
      avatarUrl: authorization.operator.avatarUrl,
    },
    operatorSession: {
      id: authorization.operatorSession.id,
      startTime: authorization.operatorSession.startTime.toISOString(),
      endTime: authorization.operatorSession.endTime?.toISOString() || null,
      status: authorization.operatorSession.status,
      startOdometer: authorization.operatorSession.startOdometer,
      startHours: authorization.operatorSession.startHours,
    },
    fuelTransaction: authorization.fuelTransaction
      ? {
          id: authorization.fuelTransaction.id,
          quantity: authorization.fuelTransaction.quantity,
          unitCost: authorization.fuelTransaction.unitCost,
          totalCost: authorization.fuelTransaction.totalCost,
          fuelType: authorization.fuelTransaction.fuelType,
          odometer: authorization.fuelTransaction.odometer,
          engineHours: authorization.fuelTransaction.engineHours,
          vendor: authorization.fuelTransaction.vendor,
          locationName: authorization.fuelTransaction.locationName,
          transactionDate: authorization.fuelTransaction.transactionDate.toISOString(),
          createdAt: authorization.fuelTransaction.createdAt.toISOString(),
        }
      : null,
  }
})
