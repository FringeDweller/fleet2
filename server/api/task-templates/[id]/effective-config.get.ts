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

  const templateId = getRouterParam(event, 'id')
  const { assetId } = getQuery(event) as { assetId?: string }

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  // Fetch the template
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

  // Start with template defaults
  let effectiveConfig = {
    templateId: template.id,
    name: template.name,
    description: template.description,
    estimatedDuration: template.estimatedDuration,
    checklistItems: template.checklistItems,
    requiredParts: template.requiredParts,
    overrideSource: null as string | null,
    overrideLevel: null as 'asset' | 'category' | null,
  }

  if (!assetId) {
    return effectiveConfig
  }

  // Fetch the asset
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Check for asset-level override (highest priority)
  const assetOverride = await db.query.taskOverrides.findFirst({
    where: and(
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.assetId, assetId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
    ),
  })

  if (assetOverride) {
    // Apply asset-level overrides
    effectiveConfig = {
      ...effectiveConfig,
      estimatedDuration:
        assetOverride.estimatedDurationOverride ?? effectiveConfig.estimatedDuration,
      checklistItems: assetOverride.checklistOverride ?? effectiveConfig.checklistItems,
      requiredParts: assetOverride.partsOverride ?? effectiveConfig.requiredParts,
      overrideSource: assetOverride.id,
      overrideLevel: 'asset',
    }
    return effectiveConfig
  }

  // Check for category-level override (second priority)
  if (asset.categoryId) {
    const categoryOverride = await db.query.taskOverrides.findFirst({
      where: and(
        eq(schema.taskOverrides.taskTemplateId, templateId),
        eq(schema.taskOverrides.categoryId, asset.categoryId),
        eq(schema.taskOverrides.organisationId, session.user.organisationId),
      ),
    })

    if (categoryOverride) {
      effectiveConfig = {
        ...effectiveConfig,
        estimatedDuration:
          categoryOverride.estimatedDurationOverride ?? effectiveConfig.estimatedDuration,
        checklistItems: categoryOverride.checklistOverride ?? effectiveConfig.checklistItems,
        requiredParts: categoryOverride.partsOverride ?? effectiveConfig.requiredParts,
        overrideSource: categoryOverride.id,
        overrideLevel: 'category',
      }
    }
  }

  return effectiveConfig
})
