import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

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
      statusMessage: 'Part ID is required',
    })
  }

  // Verify part exists and belongs to org
  const existing = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, id),
      eq(schema.parts.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Soft delete by setting isActive to false
  await db
    .update(schema.parts)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.parts.id, id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'part',
    entityId: id,
    oldValues: { sku: existing.sku, name: existing.name },
  })

  return { success: true }
})
