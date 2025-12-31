/**
 * PATCH /api/operator-sessions/:id/odometer
 *
 * Update odometer reading for an operator session.
 * Used for automatic OBD capture or manual corrections.
 */

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const updateOdometerSchema = z.object({
  type: z.enum(['start', 'end']),
  value: z.number().min(0),
  source: z.enum(['obd', 'manual']),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateOdometerSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { type, value, source } = result.data

  // Find the session
  const session = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.id, sessionId),
      eq(schema.operatorSessions.organisationId, user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          mileage: true,
        },
      },
    },
  })

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Operator session not found',
    })
  }

  // Check if user owns the session or has admin permission
  if (session.operatorId !== user.id && !user.permissions.includes('*')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only update odometer for your own sessions',
    })
  }

  // Prepare update based on type
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (type === 'start') {
    updates.startOdometer = value.toString()
  } else {
    updates.endOdometer = value.toString()

    // Calculate trip distance if we have start odometer
    if (session.startOdometer) {
      const startOdo = parseFloat(session.startOdometer)
      const tripDistance = value - startOdo
      if (tripDistance >= 0) {
        updates.tripDistance = tripDistance.toString()
      }
    }
  }

  // Update the session
  const [updatedSession] = await db
    .update(schema.operatorSessions)
    .set(updates)
    .where(eq(schema.operatorSessions.id, sessionId))
    .returning()

  // Update asset mileage if this is an end odometer reading
  if (type === 'end') {
    await db
      .update(schema.assets)
      .set({
        mileage: value.toString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.assets.id, session.assetId))
  }

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'operator_session',
    entityId: sessionId,
    oldValues: {
      [type === 'start' ? 'startOdometer' : 'endOdometer']:
        type === 'start' ? session.startOdometer : session.endOdometer,
    },
    newValues: {
      [type === 'start' ? 'startOdometer' : 'endOdometer']: value,
      source,
      assetNumber: session.asset.assetNumber,
    },
  })

  return {
    session: updatedSession,
    asset: {
      id: session.assetId,
      assetNumber: session.asset.assetNumber,
    },
    update: {
      type,
      value,
      source,
      tripDistance:
        type === 'end' && updates.tripDistance ? parseFloat(updates.tripDistance as string) : null,
    },
    message: `${type === 'start' ? 'Start' : 'End'} odometer updated to ${value.toLocaleString()} km`,
  }
})
