import {
  ENTITY_TEMPLATES,
  executeImport,
  generateImportReport,
  type ImportEntity,
} from '../../../utils/data-import'
import { requirePermission } from '../../../utils/permissions'

/**
 * Execute validated CSV import
 * POST /api/admin/import/execute
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

  try {
    // Execute import
    const result = await executeImport(body.entity, body.csv, user.organisationId, user.id)

    // Generate report
    const report = generateImportReport(result, body.entity, user.id)

    return {
      ...result,
      report,
    }
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
