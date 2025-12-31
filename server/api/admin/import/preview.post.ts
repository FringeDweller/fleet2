import { ENTITY_TEMPLATES, type ImportEntity, validateImportData } from '../../../utils/data-import'
import { requirePermission } from '../../../utils/permissions'

/**
 * Validate and preview CSV import
 * POST /api/admin/import/preview
 *
 * Request body:
 * {
 *   entity: 'assets' | 'parts' | 'users',
 *   csv: string
 * }
 */
export default defineEventHandler(async (event) => {
  // Require admin access for imports
  const user = await requirePermission(event, 'settings:write')

  const body = await readBody<{ entity: ImportEntity; csv: string }>(event)

  // Validate entity type
  if (!body.entity || !ENTITY_TEMPLATES[body.entity]) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid entity type. Must be one of: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`,
    })
  }

  // Validate CSV content exists
  if (!body.csv || typeof body.csv !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV content is required',
    })
  }

  // Check CSV is not too large (5MB limit)
  const csvSizeBytes = new Blob([body.csv]).size
  const maxSizeBytes = 5 * 1024 * 1024 // 5MB
  if (csvSizeBytes > maxSizeBytes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV file is too large. Maximum size is 5MB.',
    })
  }

  try {
    // Validate and generate preview
    const preview = await validateImportData(body.entity, body.csv, user.organisationId)

    return preview
  } catch (error) {
    if (error instanceof Error) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      })
    }
    throw error
  }
})
