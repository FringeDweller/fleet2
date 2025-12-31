/**
 * Get active DTCs endpoint (US-10.3)
 *
 * Returns all non-cleared diagnostic codes for an asset.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'assetId')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get all active (non-cleared) DTCs
  const activeCodes = await db.query.diagnosticCodes.findMany({
    where: and(
      eq(schema.diagnosticCodes.assetId, assetId),
      isNull(schema.diagnosticCodes.clearedAt),
    ),
    with: {
      readByUser: {
        columns: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: (dc, { desc }) => [desc(dc.readAt)],
  })

  return {
    success: true,
    codes: activeCodes,
    asset: { id: asset.id, assetNumber: asset.assetNumber },
  }
})
