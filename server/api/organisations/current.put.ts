import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

// Valid defect severities for blocking
const validSeverities = ['minor', 'major', 'critical'] as const

const updateOrganisationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  preventNegativeStock: z.boolean().optional(),
  // Work order approval settings
  workOrderApprovalThreshold: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
    .nullable()
    .optional(),
  requireApprovalForAllWorkOrders: z.boolean().optional(),
  // Defect escalation settings (US-9.5)
  autoCreateWorkOrderOnDefect: z.boolean().optional(),
  // Vehicle operation blocking settings (US-9.6)
  blockVehicleOnCriticalDefect: z.boolean().optional(),
  blockingDefectSeverities: z
    .array(z.enum(validSeverities))
    .min(1, 'At least one severity must be selected')
    .optional(),
  // Handover settings (US-8.5)
  handoverThresholdMinutes: z.number().int().min(5).max(120).optional(),
})

export default defineEventHandler(async (event) => {
  // Require settings:write permission to update organisation
  const user = await requirePermission(event, 'settings:write')

  const body = await readBody(event)
  const result = updateOrganisationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get current organisation
  const currentOrg = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
  })

  if (!currentOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organisation not found',
    })
  }

  const { blockingDefectSeverities, ...otherUpdates } = result.data

  // Prepare updates - convert blockingDefectSeverities array to JSON string
  const updates = {
    ...otherUpdates,
    // Store severities as JSON string if provided
    ...(blockingDefectSeverities !== undefined && {
      blockingDefectSeverities: JSON.stringify(blockingDefectSeverities),
    }),
  }

  // Update organisation
  const [updatedOrg] = await db
    .update(schema.organisations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(schema.organisations.id, user.organisationId))
    .returning()

  if (!updatedOrg) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update organisation',
    })
  }

  // Log update in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'organisation',
    entityId: user.organisationId,
    oldValues: {
      name: currentOrg.name,
      description: currentOrg.description,
      logoUrl: currentOrg.logoUrl,
      primaryColor: currentOrg.primaryColor,
      preventNegativeStock: currentOrg.preventNegativeStock,
      workOrderApprovalThreshold: currentOrg.workOrderApprovalThreshold,
      requireApprovalForAllWorkOrders: currentOrg.requireApprovalForAllWorkOrders,
      autoCreateWorkOrderOnDefect: currentOrg.autoCreateWorkOrderOnDefect,
      blockVehicleOnCriticalDefect: currentOrg.blockVehicleOnCriticalDefect,
      blockingDefectSeverities: currentOrg.blockingDefectSeverities,
      handoverThresholdMinutes: currentOrg.handoverThresholdMinutes,
    },
    newValues: {
      ...updates,
      // Include the original array format in the audit log for readability
      ...(blockingDefectSeverities !== undefined && {
        blockingDefectSeverities: blockingDefectSeverities,
      }),
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  // Parse blockingDefectSeverities for response
  const response = {
    ...updatedOrg,
    blockingDefectSeverities: (() => {
      try {
        return JSON.parse(updatedOrg.blockingDefectSeverities)
      } catch {
        return ['critical']
      }
    })(),
  }

  return response
})
