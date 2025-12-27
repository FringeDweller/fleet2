import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require work_orders:delete permission
  const user = await requirePermission(event, 'work_orders:delete')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  // Get existing work order for audit log
  const existing = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Soft delete (archive)
  await db
    .update(schema.workOrders)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.workOrders.id, id), eq(schema.workOrders.organisationId, user.organisationId)),
    )

  // Log the archive in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'archive',
    entityType: 'work_order',
    entityId: id,
    oldValues: existing,
  })

  return { success: true, message: 'Work order archived successfully' }
})
