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

  const user = session.user
  const id = getRouterParam(event, 'id')
  const partId = getRouterParam(event, 'partId')

  if (!id || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID and Part ID are required',
    })
  }

  // Verify asset exists and belongs to org
  const asset = await db.query.assets.findFirst({
    where: and(eq(schema.assets.id, id), eq(schema.assets.organisationId, user.organisationId)),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Find the assignment
  const assignment = await db.query.assetParts.findFirst({
    where: and(eq(schema.assetParts.assetId, id), eq(schema.assetParts.partId, partId)),
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part assignment not found',
    })
  }

  // Delete
  await db.delete(schema.assetParts).where(eq(schema.assetParts.id, assignment.id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'asset_part',
    entityId: assignment.id,
    oldValues: {
      assetId: id,
      partId: partId,
    },
  })

  return { success: true }
})
