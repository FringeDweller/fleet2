/**
 * US-9.5: Get defects for a specific asset
 * GET /api/assets/:id/defects
 */
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify the asset belongs to the user's organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: {
      id: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get query params for filtering
  const query = getQuery(event)
  const status = query.status as string | undefined
  const severity = query.severity as string | undefined

  // Build where conditions
  const whereConditions = [
    eq(schema.defects.assetId, assetId),
    eq(schema.defects.organisationId, session.user.organisationId),
  ]

  if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    whereConditions.push(
      eq(schema.defects.status, status as 'open' | 'in_progress' | 'resolved' | 'closed'),
    )
  }

  if (severity && ['minor', 'major', 'critical'].includes(severity)) {
    whereConditions.push(eq(schema.defects.severity, severity as 'minor' | 'major' | 'critical'))
  }

  const defects = await db.query.defects.findMany({
    where: and(...whereConditions),
    with: {
      inspection: {
        columns: {
          id: true,
          status: true,
          completedAt: true,
        },
        with: {
          template: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      workOrder: {
        columns: {
          id: true,
          workOrderNumber: true,
          status: true,
          priority: true,
        },
      },
      reportedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      resolvedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [desc(schema.defects.reportedAt)],
  })

  return defects
})
