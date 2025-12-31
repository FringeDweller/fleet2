/**
 * Get exportable columns for an entity (US-17.7)
 *
 * GET /api/admin/export/columns/:entity - Get available columns for export
 */

import { type ExportEntityType, getExportableColumns } from '../../../../utils/data-export'

const entityTypes = ['assets', 'work_orders', 'parts', 'inspections', 'fuel_transactions'] as const

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const entity = getRouterParam(event, 'entity') as ExportEntityType

  // Validate entity type
  if (!entityTypes.includes(entity)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid entity type. Must be one of: ${entityTypes.join(', ')}`,
    })
  }

  const columns = getExportableColumns(entity)

  return {
    entity,
    columns,
  }
})
