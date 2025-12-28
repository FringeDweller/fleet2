import { eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

/**
 * Complete an inventory count session
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

  // Verify the session exists and belongs to the organisation
  const countSession = await db.query.inventoryCountSessions.findFirst({
    where: (sessions, { eq, and }) =>
      and(eq(sessions.id, sessionId), eq(sessions.organisationId, session.user!.organisationId)),
    with: {
      items: {
        columns: {
          id: true,
          status: true,
        },
      },
    },
  })

  if (!countSession) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inventory count session not found',
    })
  }

  if (countSession.status !== 'in_progress') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session is already completed or cancelled',
    })
  }

  // Check if there are any pending items
  const pendingItems = countSession.items.filter((i) => i.status === 'pending')
  if (pendingItems.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot complete session with ${pendingItems.length} pending items. All items must be counted or approved/rejected.`,
    })
  }

  // Update the session to completed
  const [updated] = await db
    .update(schema.inventoryCountSessions)
    .set({
      status: 'completed',
      completedAt: new Date(),
      completedById: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.inventoryCountSessions.id, sessionId))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to complete inventory count session',
    })
  }

  // Log the completion in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'complete',
    entityType: 'inventory_count_session',
    entityId: sessionId,
    oldValues: countSession,
    newValues: updated,
  })

  return updated
})
