import {
  ENTITY_TEMPLATES,
  generateTemplate,
  type ImportEntity,
} from '../../../../utils/data-import'
import { requirePermission } from '../../../../utils/permissions'

/**
 * Download CSV template for entity import
 * GET /api/admin/import/templates/:entity
 */
export default defineEventHandler(async (event) => {
  // Require admin access for imports
  await requirePermission(event, 'settings:write')

  const entity = getRouterParam(event, 'entity') as ImportEntity

  // Validate entity type
  if (!entity || !ENTITY_TEMPLATES[entity]) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid entity type. Must be one of: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`,
    })
  }

  // Generate CSV template
  const csv = generateTemplate(entity)

  // Set response headers for CSV download
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${entity}-import-template.csv"`)

  return csv
})
