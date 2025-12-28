import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/inspection-checkpoints/definitions/:id
 *
 * Get a single checkpoint definition by ID.
 */
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
      statusMessage: 'Checkpoint definition ID is required',
    })
  }

  const definition = await db.query.inspectionCheckpointDefinitions.findFirst({
    where: and(
      eq(schema.inspectionCheckpointDefinitions.id, id),
      eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
    ),
    with: {
      assetCategory: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!definition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Checkpoint definition not found',
    })
  }

  return definition
})
