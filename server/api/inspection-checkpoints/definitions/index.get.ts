import { and, eq, isNull, or } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/inspection-checkpoints/definitions
 *
 * List checkpoint definitions for an organisation.
 * Query params:
 * - assetCategoryId: Filter by specific asset category
 * - includeInactive: Include inactive definitions
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const assetCategoryId = query.assetCategoryId as string | undefined
  const includeInactive = query.includeInactive === 'true'

  const conditions = [
    eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
  ]

  if (assetCategoryId) {
    conditions.push(eq(schema.inspectionCheckpointDefinitions.assetCategoryId, assetCategoryId))
  }

  if (!includeInactive) {
    conditions.push(eq(schema.inspectionCheckpointDefinitions.isActive, true))
  }

  const definitions = await db.query.inspectionCheckpointDefinitions.findMany({
    where: and(...conditions),
    with: {
      assetCategory: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.displayOrder), asc(table.name)],
  })

  return definitions
})
