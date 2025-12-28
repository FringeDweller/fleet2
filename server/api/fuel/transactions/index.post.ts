import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const createFuelTransactionSchema = z.object({
  assetId: z.string().uuid('Asset is required'),
  operatorSessionId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().positive().optional().nullable(),
  totalCost: z.number().positive().optional().nullable(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']).default('diesel'),
  odometer: z.number().min(0).optional().nullable(),
  engineHours: z.number().min(0).optional().nullable(),
  receiptPhotoPath: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  syncStatus: z.enum(['synced', 'pending']).default('synced'),
  transactionDate: z.string().datetime().or(z.date()),
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
  const result = createFuelTransactionSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset belongs to organisation
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

  // Verify operator session if provided
  if (result.data.operatorSessionId) {
    const operatorSession = await db.query.operatorSessions.findFirst({
      where: and(
        eq(schema.operatorSessions.id, result.data.operatorSessionId),
        eq(schema.operatorSessions.organisationId, user.organisationId),
      ),
    })

    if (!operatorSession) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Operator session not found',
      })
    }
  }

  // Calculate total cost if unit cost is provided and total isn't
  let totalCost = result.data.totalCost
  if (!totalCost && result.data.unitCost) {
    totalCost = result.data.quantity * result.data.unitCost
  }

  // Create fuel transaction
  const transactionResult = await db.transaction(async (tx) => {
    const [fuelTransaction] = await tx
      .insert(schema.fuelTransactions)
      .values({
        organisationId: user.organisationId,
        assetId: result.data.assetId,
        operatorSessionId: result.data.operatorSessionId || null,
        userId: user.id,
        quantity: result.data.quantity.toString(),
        unitCost: result.data.unitCost?.toString() || null,
        totalCost: totalCost?.toString() || null,
        fuelType: result.data.fuelType,
        odometer: result.data.odometer?.toString() || null,
        engineHours: result.data.engineHours?.toString() || null,
        receiptPhotoPath: result.data.receiptPhotoPath || null,
        latitude: result.data.latitude?.toString() || null,
        longitude: result.data.longitude?.toString() || null,
        locationName: result.data.locationName || null,
        locationAddress: result.data.locationAddress || null,
        vendor: result.data.vendor || null,
        notes: result.data.notes || null,
        syncStatus: result.data.syncStatus,
        transactionDate: new Date(result.data.transactionDate),
      })
      .returning()

    // Update asset odometer/hours if provided
    if (
      (result.data.odometer !== null && result.data.odometer !== undefined) ||
      (result.data.engineHours !== null && result.data.engineHours !== undefined)
    ) {
      const updateData: Record<string, string> = {}
      if (result.data.odometer !== null && result.data.odometer !== undefined) {
        updateData.mileage = result.data.odometer.toString()
      }
      if (result.data.engineHours !== null && result.data.engineHours !== undefined) {
        updateData.operationalHours = result.data.engineHours.toString()
      }
      if (Object.keys(updateData).length > 0) {
        await tx
          .update(schema.assets)
          .set(updateData)
          .where(eq(schema.assets.id, result.data.assetId))
      }
    }

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'create',
      entityType: 'fuel_transaction',
      entityId: fuelTransaction!.id,
      newValues: fuelTransaction,
    })

    return fuelTransaction!
  })

  return transactionResult
})
