import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Find the asset's current active session
  const session = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.assetId, assetId),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  })

  if (!session) {
    return {
      hasActiveSession: false,
      session: null,
      asset,
    }
  }

  // Calculate current duration
  const now = new Date()
  const startTime = new Date(session.startTime)
  const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60))
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return {
    hasActiveSession: true,
    session,
    asset,
    currentDuration: {
      minutes: durationMinutes,
      formatted: durationFormatted,
    },
  }
})
