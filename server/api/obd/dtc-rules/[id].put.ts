/**
 * PUT /api/obd/dtc-rules/:id
 *
 * Update a DTC work order rule
 */

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  dtcPattern: z.string().min(1).max(50).optional(),
  isRegex: z.boolean().optional(),
  shouldCreateWorkOrder: z.boolean().optional(),
  priorityMapping: z.enum(['use_severity', 'fixed']).optional(),
  fixedPriority: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  workOrderTitle: z.string().max(200).optional().nullable(),
  workOrderDescription: z.string().max(2000).optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  autoAssignToId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:write')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rule ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateRuleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

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

  // Validate regex pattern if isRegex is true
  const isRegex = data.isRegex ?? existingRule.isRegex
  const pattern = data.dtcPattern ?? existingRule.dtcPattern

  if (isRegex) {
    try {
      new RegExp(pattern)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid regex pattern',
        data: { dtcPattern: 'The pattern is not a valid regular expression' },
      })
    }
  }

  // Update the rule
  const [updatedRule] = await db
    .update(schema.dtcWorkOrderRules)
    .set({
      ...data,
      dtcPattern: data.dtcPattern?.toUpperCase() ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.dtcWorkOrderRules.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'dtc_work_order_rule',
    entityId: id,
    oldValues: existingRule,
    newValues: updatedRule,
  })

  return {
    rule: updatedRule,
    message: 'DTC work order rule updated successfully',
  }
})
