import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const alertId = getRouterParam(event, 'id')

  if (!alertId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Alert ID is required',
    })
  }

  const alert = await db.query.geofenceAlerts.findFirst({
    where: and(
      eq(schema.geofenceAlerts.id, alertId),
      eq(schema.geofenceAlerts.organisationId, session.user.organisationId),
    ),
    with: {
      geofence: {
        columns: {
          id: true,
          name: true,
          category: true,
          color: true,
          type: true,
          centerLatitude: true,
          centerLongitude: true,
          radiusMeters: true,
          polygonCoordinates: true,
        },
      },
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          status: true,
        },
      },
      operatorSession: {
        with: {
          operator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      acknowledgedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!alert) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alert not found',
    })
  }

  return alert
})
