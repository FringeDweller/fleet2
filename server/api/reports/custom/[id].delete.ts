/**
 * Delete Custom Report API (US-14.7)
 *
 * DELETE /api/reports/custom/:id
 *
 * Archives a custom report (soft delete)
 */

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
      statusMessage: 'Report ID is required',
    })
  }

  // Check that report exists and user owns it
  const existingReport = await db.query.customReports.findFirst({
    where: and(
      eq(schema.customReports.id, id),
      eq(schema.customReports.organisationId, session.user.organisationId),
      eq(schema.customReports.userId, session.user.id), // Only owner can delete
    ),
  })

  if (!existingReport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Custom report not found or you do not have permission to delete it',
    })
  }

  // Soft delete (archive)
  await db
    .update(schema.customReports)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.customReports.id, id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'custom_report',
    entityId: id,
    oldValues: { name: existingReport.name },
  })

  return { success: true }
})
