import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const transferSchema = z.object({
  partId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = transferSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { partId, fromLocationId, toLocationId, quantity, notes, referenceNumber } = result.data

  // Ensure user is defined for transaction scope
  const organisationId = session.user.organisationId
  const userId = session.user.id

  // Validate transfer: from and to locations must be different
  if (fromLocationId === toLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Source and destination locations must be different',
    })
  }

  // Verify part exists
  const part = await db.query.parts.findFirst({
    where: and(eq(schema.parts.id, partId), eq(schema.parts.organisationId, organisationId)),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Verify from location exists
  const fromLocation = await db.query.storageLocations.findFirst({
    where: and(
      eq(schema.storageLocations.id, fromLocationId),
      eq(schema.storageLocations.organisationId, organisationId),
      eq(schema.storageLocations.isActive, true),
    ),
  })

  if (!fromLocation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Source location not found or inactive',
    })
  }

  // Verify to location exists
  const toLocation = await db.query.storageLocations.findFirst({
    where: and(
      eq(schema.storageLocations.id, toLocationId),
      eq(schema.storageLocations.organisationId, organisationId),
      eq(schema.storageLocations.isActive, true),
    ),
  })

  if (!toLocation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Destination location not found or inactive',
    })
  }

  // Execute transfer in a transaction
  const transfer = await db.transaction(async (tx) => {
    // Get current quantity at source location
    const fromQuantity = await tx.query.partLocationQuantities.findFirst({
      where: and(
        eq(schema.partLocationQuantities.partId, partId),
        eq(schema.partLocationQuantities.locationId, fromLocationId),
        eq(schema.partLocationQuantities.organisationId, organisationId),
      ),
    })

    // Check if source has enough quantity
    const currentQuantity = fromQuantity ? parseFloat(fromQuantity.quantity.toString()) : 0
    if (currentQuantity < quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `Insufficient quantity at source location. Available: ${currentQuantity}, Required: ${quantity}`,
      })
    }

    // Deduct from source location
    if (fromQuantity) {
      const newFromQuantity = currentQuantity - quantity
      if (newFromQuantity === 0) {
        // Remove record if quantity becomes zero
        await tx
          .delete(schema.partLocationQuantities)
          .where(eq(schema.partLocationQuantities.id, fromQuantity.id))
      } else {
        await tx
          .update(schema.partLocationQuantities)
          .set({ quantity: newFromQuantity.toString(), updatedAt: new Date() })
          .where(eq(schema.partLocationQuantities.id, fromQuantity.id))
      }
    }

    // Add to destination location
    const toQuantity = await tx.query.partLocationQuantities.findFirst({
      where: and(
        eq(schema.partLocationQuantities.partId, partId),
        eq(schema.partLocationQuantities.locationId, toLocationId),
        eq(schema.partLocationQuantities.organisationId, organisationId),
      ),
    })

    if (toQuantity) {
      // Update existing quantity
      const newToQuantity = parseFloat(toQuantity.quantity.toString()) + quantity
      await tx
        .update(schema.partLocationQuantities)
        .set({ quantity: newToQuantity.toString(), updatedAt: new Date() })
        .where(eq(schema.partLocationQuantities.id, toQuantity.id))
    } else {
      // Create new quantity record
      await tx.insert(schema.partLocationQuantities).values({
        organisationId,
        partId,
        locationId: toLocationId,
        quantity: quantity.toString(),
      })
    }

    // Record the transfer
    const [transferRecord] = await tx
      .insert(schema.inventoryTransfers)
      .values({
        organisationId,
        partId,
        fromLocationId,
        toLocationId,
        quantity: quantity.toString(),
        transferredById: userId,
        notes,
        referenceNumber,
      })
      .returning()

    // Audit log
    await tx.insert(schema.auditLog).values({
      organisationId,
      userId,
      action: 'transfer',
      entityType: 'inventory',
      entityId: transferRecord!.id,
      newValues: {
        partId,
        from: fromLocation.name,
        to: toLocation.name,
        quantity,
      },
    })

    return transferRecord
  })

  return transfer
})
