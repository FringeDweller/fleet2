/**
 * POST /api/obd/dtc-rules
 *
 * Create a new DTC-to-work-order rule
 */

import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  dtcPattern: z.string().min(1).max(50),
  isRegex: z.boolean().default(false),
  shouldCreateWorkOrder: z.boolean().default(true),
  priorityMapping: z.enum(['use_severity', 'fixed']).default('use_severity'),
  fixedPriority: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  workOrderTitle: z.string().max(200).optional().nullable(),
  workOrderDescription: z.string().max(2000).optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  autoAssignToId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:write')

  const body = await readBody(event)
  const result = createRuleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Validate regex pattern if isRegex is true
  if (data.isRegex) {
    try {
      new RegExp(data.dtcPattern)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid regex pattern',
        data: { dtcPattern: 'The pattern is not a valid regular expression' },
      })
    }
  }

  // Create the rule
  const [rule] = await db
    .insert(schema.dtcWorkOrderRules)
    .values({
      organisationId: user.organisationId,
      name: data.name,
      description: data.description || null,
      dtcPattern: data.dtcPattern.toUpperCase(),
      isRegex: data.isRegex,
      shouldCreateWorkOrder: data.shouldCreateWorkOrder,
      priorityMapping: data.priorityMapping,
      fixedPriority: data.fixedPriority || null,
      workOrderTitle: data.workOrderTitle || null,
      workOrderDescription: data.workOrderDescription || null,
      templateId: data.templateId || null,
      autoAssignToId: data.autoAssignToId || null,
      isActive: data.isActive,
      createdById: user.id,
    })
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'dtc_work_order_rule',
    entityId: rule!.id,
    newValues: rule,
  })

  return {
    rule,
    message: 'DTC work order rule created successfully',
  }
})
