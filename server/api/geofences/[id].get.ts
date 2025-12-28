import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Geofence ID is required',
    })
  }

  const geofence = await db.query.geofences.findFirst({
    where: and(
      eq(schema.geofences.id, id),
      eq(schema.geofences.organisationId, user.organisationId),
    ),
  })

  if (!geofence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Geofence not found',
    })
  }

  return geofence
})
