import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

/**
 * GET /api/obd/devices/:assetId
 *
 * Get the active OBD device pairing for an asset.
 * Returns the paired device information or null if no pairing exists.
 *
 * @requirement US-10.1 OBD Dongle Pairing
 * @requirement US-10.2 Automatic OBD Connection
 */

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const assetId = getRouterParam(event, 'assetId')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify the asset exists and belongs to the user's organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get the active pairing for this asset
  const device = await db.query.obdDevices.findFirst({
    where: and(
      eq(schema.obdDevices.assetId, assetId),
      eq(schema.obdDevices.organisationId, user.organisationId),
      eq(schema.obdDevices.isActive, true),
    ),
    with: {
      pairedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!device) {
    // Return null instead of 404 to indicate no pairing exists
    return null
  }

  return {
    id: device.id,
    assetId: device.assetId,
    bluetoothDeviceId: device.bluetoothDeviceId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    serviceUuid: device.serviceUuid,
    isActive: device.isActive,
    lastConnectedAt: device.lastConnectedAt,
    metadata: device.metadata ? JSON.parse(device.metadata) : null,
    pairedBy: device.pairedBy,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  }
})
