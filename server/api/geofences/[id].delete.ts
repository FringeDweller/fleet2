import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:delete permission to delete geofences
  const user = await requirePermission(event, 'assets:delete')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Geofence ID is required',
    })
  }

  // Get existing geofence for audit log
  const existingGeofence = await db.query.geofences.findFirst({
    where: and(
      eq(schema.geofences.id, id),
      eq(schema.geofences.organisationId, user.organisationId),
    ),
  })

  if (!existingGeofence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Geofence not found',
    })
  }

  // Delete the geofence (hard delete since geofences don't need soft delete)
  await db
    .delete(schema.geofences)
    .where(
      and(eq(schema.geofences.id, id), eq(schema.geofences.organisationId, user.organisationId)),
    )

  // Log the deletion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'geofence',
    entityId: id,
    oldValues: existingGeofence,
    newValues: null,
  })

  return { success: true, message: 'Geofence deleted successfully' }
})
