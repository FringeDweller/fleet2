import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * DELETE /api/obd/devices/:id
 *
 * Remove an OBD device pairing.
 * Soft-deletes by setting isActive to false.
 *
 * @requirement US-10.1 OBD Dongle Pairing - Manual disconnect option
 */

export default defineEventHandler(async (event) => {
  // Require assets:write permission to remove OBD device pairings
  const user = await requirePermission(event, 'assets:write')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Device ID is required',
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

  // Soft delete by deactivating the pairing
  await db
    .update(schema.obdDevices)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.obdDevices.id, id))

  // Log the removal in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'obd_device',
    entityId: device.id,
    oldValues: {
      assetId: device.assetId,
      deviceName: device.deviceName,
    },
  })

  return { success: true }
})
