import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * POST /api/obd/devices
 *
 * Register a new OBD device pairing for an asset.
 * If a pairing already exists for this asset, it is deactivated and replaced.
 *
 * @requirement US-10.1 OBD Dongle Pairing
 */

const createObdDeviceSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  bluetoothDeviceId: z.string().min(1, 'Bluetooth device ID is required').max(255),
  deviceName: z.string().min(1, 'Device name is required').max(255),
  deviceType: z.enum(['elm327', 'obd_link', 'vgate', 'other']).optional().default('elm327'),
  serviceUuid: z.string().max(36).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  // Require assets:write permission to pair OBD devices
  const user = await requirePermission(event, 'assets:write')

  const body = await readBody(event)
  const result = createObdDeviceSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { assetId, bluetoothDeviceId, deviceName, deviceType, serviceUuid, metadata } = result.data

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

  // Deactivate any existing active pairing for this asset
  await db
    .update(schema.obdDevices)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.obdDevices.assetId, assetId), eq(schema.obdDevices.isActive, true)))

  // Create new pairing
  const [device] = await db
    .insert(schema.obdDevices)
    .values({
      organisationId: user.organisationId,
      assetId,
      bluetoothDeviceId,
      deviceName,
      deviceType,
      serviceUuid,
      metadata: metadata ? JSON.stringify(metadata) : null,
      pairedById: user.id,
      isActive: true,
    })
    .returning()

  if (!device) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create OBD device pairing',
    })
  }

  // Log the pairing in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'obd_device',
    entityId: device.id,
    newValues: {
      assetId,
      deviceName,
      deviceType,
      bluetoothDeviceId: `${bluetoothDeviceId.substring(0, 20)}...`, // Truncate for privacy
    },
  })

  return device
})
