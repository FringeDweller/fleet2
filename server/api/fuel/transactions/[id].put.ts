import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const updateFuelTransactionSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  unitCost: z.number().positive().optional().nullable(),
  totalCost: z.number().positive().optional().nullable(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']).optional(),
  odometer: z.number().min(0).optional().nullable(),
  engineHours: z.number().min(0).optional().nullable(),
  receiptPhotoPath: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  transactionDate: z.string().datetime().or(z.date()).optional(),
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
      statusMessage: 'Transaction ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateFuelTransactionSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Find existing transaction
  const existing = await db.query.fuelTransactions.findFirst({
    where: and(
      eq(schema.fuelTransactions.id, id),
      eq(schema.fuelTransactions.organisationId, user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fuel transaction not found',
    })
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.quantity !== undefined) {
    updateData.quantity = result.data.quantity.toString()
  }
  if (result.data.unitCost !== undefined) {
    updateData.unitCost = result.data.unitCost?.toString() || null
  }
  if (result.data.totalCost !== undefined) {
    updateData.totalCost = result.data.totalCost?.toString() || null
  } else if (result.data.unitCost !== undefined && result.data.quantity !== undefined) {
    // Recalculate total cost
    updateData.totalCost = (result.data.quantity * (result.data.unitCost || 0)).toString()
  }
  if (result.data.fuelType !== undefined) {
    updateData.fuelType = result.data.fuelType
  }
  if (result.data.odometer !== undefined) {
    updateData.odometer = result.data.odometer?.toString() || null
  }
  if (result.data.engineHours !== undefined) {
    updateData.engineHours = result.data.engineHours?.toString() || null
  }
  if (result.data.receiptPhotoPath !== undefined) {
    updateData.receiptPhotoPath = result.data.receiptPhotoPath
  }
  if (result.data.latitude !== undefined) {
    updateData.latitude = result.data.latitude?.toString() || null
  }
  if (result.data.longitude !== undefined) {
    updateData.longitude = result.data.longitude?.toString() || null
  }
  if (result.data.locationName !== undefined) {
    updateData.locationName = result.data.locationName
  }
  if (result.data.locationAddress !== undefined) {
    updateData.locationAddress = result.data.locationAddress
  }
  if (result.data.vendor !== undefined) {
    updateData.vendor = result.data.vendor
  }
  if (result.data.notes !== undefined) {
    updateData.notes = result.data.notes
  }
  if (result.data.transactionDate !== undefined) {
    updateData.transactionDate = new Date(result.data.transactionDate)
  }

  // Update transaction
  const transactionResult = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.fuelTransactions)
      .set(updateData)
      .where(eq(schema.fuelTransactions.id, id))
      .returning()

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entityType: 'fuel_transaction',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    })

    return updated!
  })

  return transactionResult
})
