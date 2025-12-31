/**
 * Delete scheduled export (US-17.7)
 *
 * DELETE /api/admin/export/scheduled/:id - Delete a scheduled export
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

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
      statusMessage: 'Export ID is required',
    })
  }

  // Find the scheduled export
  const scheduledExport = await db.query.scheduledExports.findFirst({
    where: and(
      eq(schema.scheduledExports.id, id),
      eq(schema.scheduledExports.organisationId, session.user.organisationId),
    ),
  })

  if (!scheduledExport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scheduled export not found',
    })
  }

  // Delete the scheduled export
  await db.delete(schema.scheduledExports).where(eq(schema.scheduledExports.id, id))

  // Log in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'scheduled_exports',
    entityId: id,
    oldValues: {
      name: scheduledExport.name,
      entity: scheduledExport.entity,
      frequency: scheduledExport.frequency,
    },
  })

  return { success: true }
})
