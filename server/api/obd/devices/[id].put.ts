import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

/**
 * PUT /api/obd/devices/:id
 *
 * Update an OBD device pairing.
 * Used to update last connected timestamp and metadata.
 *
 * @requirement US-10.2 Automatic OBD Connection - Connection status indicator
 */

const updateObdDeviceSchema = z.object({
  lastConnectedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Device ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateObdDeviceSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Find the device and verify it belongs to the user's organisation
  const device = await db.query.obdDevices.findFirst({
    where: and(
      eq(schema.obdDevices.id, id),
      eq(schema.obdDevices.organisationId, user.organisationId),
    ),
  })

  if (!device) {
    throw createError({
      statusCode: 404,
      statusMessage: 'OBD device not found',
    })
  }

  // Build update object
  const updates: Partial<typeof schema.obdDevices.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (result.data.lastConnectedAt) {
    updates.lastConnectedAt = new Date(result.data.lastConnectedAt)
  }

  if (result.data.metadata !== undefined) {
    updates.metadata = result.data.metadata ? JSON.stringify(result.data.metadata) : null
  }

  // Update the device
  const [updatedDevice] = await db
    .update(schema.obdDevices)
    .set(updates)
    .where(eq(schema.obdDevices.id, id))
    .returning()

  return updatedDevice
})
