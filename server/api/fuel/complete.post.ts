import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { markAsCompleted, validateAuthorization } from '../../utils/fuel-auth'

const completeSchema = z.object({
  // Auth code from the authorization
  authCode: z.string().min(1, 'Auth code is required').max(10),
  // Dispensed fuel details
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().positive().optional().nullable(),
  totalCost: z.number().positive().optional().nullable(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']).optional(),
  // Optional readings
  odometer: z.number().min(0).optional().nullable(),
  engineHours: z.number().min(0).optional().nullable(),
  // Location (from bowser GPS)
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  // Bowser/pump identifier
  vendor: z.string().max(255).optional().nullable(),
  pumpId: z.string().max(100).optional().nullable(),
  // Additional notes
  notes: z.string().optional().nullable(),
  // Transaction timestamp (bowser time)
  transactionDate: z.string().datetime().optional(),
})

/**
 * Complete fuel transaction after dispensing
 * This endpoint is called by the bowser system after fuel has been dispensed
 *
 * Creates the fuel transaction record and marks authorization as completed
 */
export default defineEventHandler(async (event) => {
  // Note: This endpoint is called by bowser equipment
  // In production, add API key validation for bowser equipment

  const body = await readBody(event)
  const result = completeSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Validate the authorization
  const validationResult = await validateAuthorization(data.authCode)

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

  // Check pre-auth limits if set
  if (authorization.maxQuantityLitres) {
    const maxLitres = Number.parseFloat(authorization.maxQuantityLitres)
    if (data.quantity > maxLitres) {
      throw createError({
        statusCode: 400,
        statusMessage: `Quantity exceeds pre-authorized limit of ${maxLitres} litres`,
        data: {
          code: 'EXCEEDS_QUANTITY_LIMIT',
          dispensed: data.quantity,
          limit: maxLitres,
        },
      })
    }
  }

  if (authorization.maxAmountDollars && data.totalCost) {
    const maxDollars = Number.parseFloat(authorization.maxAmountDollars)
    if (data.totalCost > maxDollars) {
      throw createError({
        statusCode: 400,
        statusMessage: `Total cost exceeds pre-authorized limit of $${maxDollars}`,
        data: {
          code: 'EXCEEDS_AMOUNT_LIMIT',
          totalCost: data.totalCost,
          limit: maxDollars,
        },
      })
    }
  }

  // Calculate total cost if not provided
  let totalCost = data.totalCost
  if (!totalCost && data.unitCost) {
    totalCost = data.quantity * data.unitCost
  }

  // Determine fuel type (from data or default to 'diesel')
  const fuelType = data.fuelType || 'diesel'

  // Create fuel transaction and complete authorization in a transaction
  const transactionResult = await db.transaction(async (tx) => {
    // Create fuel transaction
    const [fuelTransaction] = await tx
      .insert(schema.fuelTransactions)
      .values({
        organisationId: authorization.organisationId,
        assetId: authorization.assetId,
        operatorSessionId: authorization.operatorSessionId,
        userId: authorization.operatorId,
        quantity: data.quantity.toString(),
        unitCost: data.unitCost?.toString() || null,
        totalCost: totalCost?.toString() || null,
        fuelType,
        odometer: data.odometer?.toString() || null,
        engineHours: data.engineHours?.toString() || null,
        latitude: data.latitude?.toString() || null,
        longitude: data.longitude?.toString() || null,
        locationName: data.locationName || null,
        locationAddress: data.locationAddress || null,
        vendor: data.vendor || data.pumpId || null,
        notes: data.notes || null,
        syncStatus: 'synced',
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
      })
      .returning()

    // Mark authorization as completed
    await markAsCompleted(authorization.id, fuelTransaction!.id)

    // Update asset odometer/hours if provided
    if (
      (data.odometer !== null && data.odometer !== undefined) ||
      (data.engineHours !== null && data.engineHours !== undefined)
    ) {
      const updateData: Record<string, string | Date> = {
        updatedAt: new Date(),
      }
      if (data.odometer !== null && data.odometer !== undefined) {
        updateData.mileage = data.odometer.toString()
      }
      if (data.engineHours !== null && data.engineHours !== undefined) {
        updateData.operationalHours = data.engineHours.toString()
      }
      await tx
        .update(schema.assets)
        .set(updateData)
        .where(eq(schema.assets.id, authorization.assetId))
    }

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: authorization.organisationId,
      userId: authorization.operatorId,
      action: 'fuel_transaction_completed',
      entityType: 'fuel_transaction',
      entityId: fuelTransaction!.id,
      newValues: {
        authorizationId: authorization.id,
        authCode: authorization.authCode,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost,
        fuelType,
        vendor: data.vendor,
        pumpId: data.pumpId,
      },
    })

    return fuelTransaction!
  })

  return {
    success: true,
    fuelTransaction: {
      id: transactionResult.id,
      quantity: transactionResult.quantity,
      unitCost: transactionResult.unitCost,
      totalCost: transactionResult.totalCost,
      fuelType: transactionResult.fuelType,
      transactionDate: transactionResult.transactionDate.toISOString(),
    },
    authorization: {
      id: authorization.id,
      authCode: authorization.authCode,
      status: 'completed',
    },
    asset: {
      id: authorization.asset.id,
      assetNumber: authorization.asset.assetNumber,
    },
    operator: {
      id: authorization.operator.id,
      name: `${authorization.operator.firstName} ${authorization.operator.lastName}`,
    },
    message: `Fuel transaction completed. ${data.quantity}L dispensed to ${authorization.asset.assetNumber}.`,
  }
})
