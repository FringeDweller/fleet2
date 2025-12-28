import { and, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const templateId = getRouterParam(event, 'id')

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  // Verify the template exists and belongs to the organization
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Fetch all asset-level overrides
  const assetOverrides = await db.query.taskOverrides.findMany({
    where: and(
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
      isNotNull(schema.taskOverrides.assetId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          status: true,
        },
      },
    },
  })

  // Fetch all category-level overrides with affected assets
  const categoryOverrides = await db.query.taskOverrides.findMany({
    where: and(
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
      isNotNull(schema.taskOverrides.categoryId),
    ),
    with: {
      category: {
        columns: {
          id: true,
          name: true,
        },
        with: {
          assets: {
            columns: {
              id: true,
              assetNumber: true,
              make: true,
              model: true,
              year: true,
              status: true,
            },
          },
        },
      },
    },
  })

  return {
    assetOverrides: assetOverrides.map((o) => ({
      overrideId: o.id,
      asset: o.asset,
      overrideType: 'asset' as const,
    })),
    categoryOverrides: categoryOverrides.map((o) => ({
      overrideId: o.id,
      category: o.category,
      affectedAssets: o.category?.assets || [],
      overrideType: 'category' as const,
    })),
  }
})
