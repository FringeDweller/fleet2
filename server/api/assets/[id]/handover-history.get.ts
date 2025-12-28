import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission
  const user = await requirePermission(event, 'assets:read')

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

  // Get handover history - sessions that were handed over from
  // This includes sessions that have a handoverFromSessionId (i.e., received a handover)
  const handoverSessions = await db.query.operatorSessions.findMany({
    where: and(
      eq(schema.operatorSessions.assetId, assetId),
      isNotNull(schema.operatorSessions.handoverFromSessionId),
    ),
    with: {
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      handoverFromSession: {
        columns: {
          id: true,
          startTime: true,
          endTime: true,
          tripDurationMinutes: true,
          tripDistance: true,
          startOdometer: true,
          endOdometer: true,
        },
        with: {
          operator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: [desc(schema.operatorSessions.startTime)],
    limit,
    offset,
  })

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.operatorSessions)
    .where(
      and(
        eq(schema.operatorSessions.assetId, assetId),
        isNotNull(schema.operatorSessions.handoverFromSessionId),
      ),
    )

  const total = countResult[0]?.count || 0

  // Transform the data into a more usable format
  const handoverHistory = handoverSessions.map((session) => {
    const handoverTypeLabels: Record<string, string> = {
      shift_change: 'Shift Change',
      break: 'Break',
      emergency: 'Emergency',
      other: 'Other',
    }

    return {
      id: session.id,
      // Who handed over (previous operator)
      fromOperator: session.handoverFromSession?.operator || null,
      fromSession: session.handoverFromSession
        ? {
            id: session.handoverFromSession.id,
            startTime: session.handoverFromSession.startTime,
            endTime: session.handoverFromSession.endTime,
            tripDurationMinutes: session.handoverFromSession.tripDurationMinutes,
            tripDistance: session.handoverFromSession.tripDistance
              ? parseFloat(session.handoverFromSession.tripDistance)
              : null,
            startOdometer: session.handoverFromSession.startOdometer
              ? parseFloat(session.handoverFromSession.startOdometer)
              : null,
            endOdometer: session.handoverFromSession.endOdometer
              ? parseFloat(session.handoverFromSession.endOdometer)
              : null,
          }
        : null,
      // Who received the handover (new operator)
      toOperator: session.operator,
      toSession: {
        id: session.id,
        startTime: session.startTime,
        status: session.status,
      },
      // Handover details
      handoverType: session.handoverType,
      handoverTypeLabel: session.handoverType ? handoverTypeLabels[session.handoverType] : null,
      handoverReason: session.handoverReason,
      sessionGap: session.sessionGap,
      isLinkedSession: session.isLinkedSession,
      handoverTime: session.startTime,
    }
  })

  return {
    data: handoverHistory,
    asset,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + handoverSessions.length < total,
    },
  }
})
