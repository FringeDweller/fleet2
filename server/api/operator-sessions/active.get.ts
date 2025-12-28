import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require authenticated user
  const user = await requireAuth(event)

  // Find the user's current active session
  const session = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.operatorId, user.id),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          imageUrl: true,
          mileage: true,
          operationalHours: true,
        },
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
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
  })

  if (!session) {
    return {
      hasActiveSession: false,
      session: null,
    }
  }

  // Calculate current duration
  const now = new Date()
  const startTime = new Date(session.startTime)
  const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60))
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return {
    hasActiveSession: true,
    session,
    currentDuration: {
      minutes: durationMinutes,
      formatted: durationFormatted,
    },
  }
})
