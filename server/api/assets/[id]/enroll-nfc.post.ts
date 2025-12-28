import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to the organization
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const body = await readBody(event)
  const { tagId } = body

  // Log NFC enrollment in asset location history (using the existing table)
  await db.insert(schema.assetLocationHistory).values({
    assetId: id,
    latitude: asset.latitude || '0',
    longitude: asset.longitude || '0',
    locationName: null,
    locationAddress: null,
    notes: `NFC tag enrolled: ${tagId || 'Unknown'}`,
    source: 'nfc_enrollment',
    recordedAt: new Date(),
    updatedById: session.user.id,
  })

  return {
    success: true,
    assetId: id,
    assetNumber: asset.assetNumber,
    tagId,
    enrolledAt: new Date().toISOString(),
  }
})
