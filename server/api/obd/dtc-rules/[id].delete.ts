/**
 * DELETE /api/obd/dtc-rules/:id
 *
 * Delete a DTC work order rule
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:write')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rule ID is required',
    })
  }

  // Find existing rule
  const existingRule = await db.query.dtcWorkOrderRules.findFirst({
    where: and(
      eq(schema.dtcWorkOrderRules.id, id),
      eq(schema.dtcWorkOrderRules.organisationId, user.organisationId),
    ),
  })

  if (!existingRule) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DTC work order rule not found',
    })
  }

  // Delete the rule
  await db.delete(schema.dtcWorkOrderRules).where(eq(schema.dtcWorkOrderRules.id, id))

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'dtc_work_order_rule',
    entityId: id,
    oldValues: existingRule,
  })

  return {
    message: 'DTC work order rule deleted successfully',
  }
})
