/**
 * GET /api/obd/dtc-rules
 *
 * List all DTC-to-work-order rules for the organisation
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:read')

  const rules = await db.query.dtcWorkOrderRules.findMany({
    where: eq(schema.dtcWorkOrderRules.organisationId, user.organisationId),
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
    orderBy: (rules, { asc }) => [asc(rules.name)],
  })

  return {
    data: rules,
    total: rules.length,
  }
})
