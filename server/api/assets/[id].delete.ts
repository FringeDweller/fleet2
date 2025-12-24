import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required'
    })
  }

  // Get existing asset for audit log
  const existingAsset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId)
    )
  })

  if (!existingAsset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found'
    })
  }

  // Soft delete (archive) the asset
  const [archivedAsset] = await db
    .update(schema.assets)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(schema.assets.id, id),
        eq(schema.assets.organisationId, session.user.organisationId)
      )
    )
    .returning()

  // Log the archive in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'archive',
    entityType: 'asset',
    entityId: id,
    oldValues: existingAsset,
    newValues: archivedAsset
  })

  return { success: true, message: 'Asset archived successfully' }
})
