/**
 * GET /api/obd/dtc-rules/:id
 *
 * Get a specific DTC work order rule
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:read')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rule ID is required',
    })
  }

  const rule = await db.query.dtcWorkOrderRules.findFirst({
    where: and(
      eq(schema.dtcWorkOrderRules.id, id),
      eq(schema.dtcWorkOrderRules.organisationId, user.organisationId),
    ),
    with: {
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      autoAssignTo: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      template: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!rule) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DTC work order rule not found',
    })
  }

  return rule
})
