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
      statusMessage: 'Missing saved search ID',
    })
  }

  // Check if user owns this saved search
  const existing = await db.query.savedSearches.findFirst({
    where: and(
      eq(schema.savedSearches.id, id),
      eq(schema.savedSearches.organisationId, session.user.organisationId),
      eq(schema.savedSearches.userId, session.user.id),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved search not found or you do not have permission to delete it',
    })
  }

  await db.delete(schema.savedSearches).where(eq(schema.savedSearches.id, id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'saved_search',
    entityId: id,
    oldValues: { name: existing.name, filters: existing.filters },
  })

  return { success: true }
})
