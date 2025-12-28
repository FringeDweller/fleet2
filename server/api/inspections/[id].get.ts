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
      statusMessage: 'Inspection ID is required',
    })
  }

  const inspection = await db.query.inspections.findFirst({
    where: and(
      eq(schema.inspections.id, id),
      eq(schema.inspections.organisationId, session.user.organisationId),
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
      template: {
        columns: {
          id: true,
          name: true,
          description: true,
          checklistItems: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      },
      items: true,
    },
  })

  if (!inspection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection not found',
    })
  }

  return inspection
})
