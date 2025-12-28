import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * DELETE /api/inspection-checkpoints/definitions/:id
 *
 * Delete (soft-delete by deactivating) a checkpoint definition.
 * Hard delete is prevented if the checkpoint has been used in scans.
 */
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
      statusMessage: 'Checkpoint definition ID is required',
    })
  }

  // Get existing definition
  const existing = await db.query.inspectionCheckpointDefinitions.findFirst({
    where: and(
      eq(schema.inspectionCheckpointDefinitions.id, id),
      eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Checkpoint definition not found',
    })
  }

  // Check if any scans exist for this checkpoint
  const scans = await db.query.inspectionCheckpointScans.findFirst({
    where: eq(schema.inspectionCheckpointScans.checkpointDefinitionId, id),
  })

  if (scans) {
    // Soft delete - deactivate instead of deleting
    await db
      .update(schema.inspectionCheckpointDefinitions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.inspectionCheckpointDefinitions.id, id))

    // Log audit entry
    await db.insert(schema.auditLog).values({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: 'deactivate',
      entityType: 'inspection_checkpoint_definition',
      entityId: id,
      oldValues: existing,
      newValues: { isActive: false },
    })

    return { message: 'Checkpoint definition deactivated (has existing scan history)' }
  }

  // Hard delete if no scans exist
  await db
    .delete(schema.inspectionCheckpointDefinitions)
    .where(eq(schema.inspectionCheckpointDefinitions.id, id))

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'inspection_checkpoint_definition',
    entityId: id,
    oldValues: existing,
  })

  return { message: 'Checkpoint definition deleted' }
})
