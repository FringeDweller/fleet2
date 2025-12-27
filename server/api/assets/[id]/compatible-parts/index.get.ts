import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

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
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to org
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    with: {
      category: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get parts directly assigned to this asset
  const assetParts = await db.query.assetParts.findMany({
    where: eq(schema.assetParts.assetId, id),
    with: {
      part: {
        with: {
          category: true,
        },
      },
    },
  })

  // Get parts inherited from category (if asset has a category)
  let categoryPartsRaw: {
    id: string
    categoryId: string
    partId: string
    notes: string | null
    createdAt: Date
    part: (typeof assetParts)[number]['part']
  }[] = []
  if (asset.categoryId) {
    const results = await db.query.assetCategoryParts.findMany({
      where: eq(schema.assetCategoryParts.categoryId, asset.categoryId),
      with: {
        part: {
          with: {
            category: true,
          },
        },
      },
    })
    categoryPartsRaw = results as typeof categoryPartsRaw
  }

  // Combine and dedupe, marking source
  const directPartIds = new Set(assetParts.map((ap) => ap.part.id))

  const combinedParts = [
    ...assetParts.map((ap) => ({
      id: ap.id,
      partId: ap.part.id,
      part: ap.part,
      notes: ap.notes,
      source: 'asset' as const,
      createdAt: ap.createdAt,
    })),
    ...categoryPartsRaw
      .filter((cp) => !directPartIds.has(cp.part.id))
      .map((cp) => ({
        id: cp.id,
        partId: cp.part.id,
        part: cp.part,
        notes: cp.notes,
        source: 'category' as const,
        createdAt: cp.createdAt,
      })),
  ]

  return {
    data: combinedParts,
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      make: asset.make,
      model: asset.model,
      category: asset.category,
    },
  }
})
