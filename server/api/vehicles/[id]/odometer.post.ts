import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const updateOdometerSchema = z.object({
  odometer: z.number().min(0, 'Odometer reading must be a positive number'),
  notes: z.string().max(500).optional(),
  source: z.enum(['manual', 'gps', 'obd', 'inspection', 'fuel']).default('manual'),
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
      statusMessage: 'Vehicle ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateOdometerSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify vehicle (asset) exists and belongs to organisation
  const vehicle = await db.query.assets.findFirst({
    where: and(eq(schema.assets.id, id), eq(schema.assets.organisationId, user.organisationId)),
  })

  if (!vehicle) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vehicle not found',
    })
  }

  // Validate that new odometer reading is >= current reading
  const currentOdometer = vehicle.mileage ? Number.parseFloat(vehicle.mileage) : 0
  if (result.data.odometer < currentOdometer) {
    throw createError({
      statusCode: 400,
      statusMessage: `Odometer reading must be greater than or equal to current reading (${currentOdometer})`,
    })
  }

  const now = new Date()

  // Update vehicle odometer
  const [updatedVehicle] = await db
    .update(schema.assets)
    .set({
      mileage: result.data.odometer.toString(),
      updatedAt: now,
    })
    .where(and(eq(schema.assets.id, id), eq(schema.assets.organisationId, user.organisationId)))
    .returning()

  if (!updatedVehicle) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update odometer reading',
    })
  }

  // Log the odometer change in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'odometer_update',
    entityType: 'asset',
    entityId: id,
    oldValues: {
      mileage: vehicle.mileage,
    },
    newValues: {
      mileage: result.data.odometer.toString(),
      source: result.data.source,
      notes: result.data.notes,
    },
  })

  return {
    id: updatedVehicle.id,
    assetNumber: updatedVehicle.assetNumber,
    make: updatedVehicle.make,
    model: updatedVehicle.model,
    year: updatedVehicle.year,
    licensePlate: updatedVehicle.licensePlate,
    previousOdometer: currentOdometer,
    odometer: Number.parseFloat(updatedVehicle.mileage || '0'),
    updatedAt: updatedVehicle.updatedAt,
  }
})
