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
      statusMessage: 'Defect ID is required',
    })
  }

  const defect = await db.query.defects.findFirst({
    where: and(
      eq(schema.defects.id, id),
      eq(schema.defects.organisationId, session.user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
        },
      },
      inspection: {
        columns: {
          id: true,
          status: true,
          overallResult: true,
          startedAt: true,
          completedAt: true,
        },
        with: {
          operator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          template: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      inspectionItem: {
        columns: {
          id: true,
          checklistItemLabel: true,
          checklistItemType: true,
          result: true,
          notes: true,
        },
      },
      workOrder: {
        columns: {
          id: true,
          workOrderNumber: true,
          status: true,
          priority: true,
          title: true,
        },
      },
      reportedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      resolvedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  if (!defect) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Defect not found',
    })
  }

  return defect
})
