/**
 * US-9.6: Supervisor Override for Operation Blocks
 * Allows supervisors to override vehicle operation blocks with a reason
 */
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { isSupervisor, requireAuth } from '../../../utils/permissions'

const overrideSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
  defectIds: z.array(z.string().uuid()).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Only supervisors and above can override blocks
  if (!isSupervisor(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only supervisors, managers, and admins can override operation blocks',
    })
  }

  const body = await readBody(event)
  const result = overrideSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { reason, defectIds } = result.data

  // Verify asset exists and belongs to user's organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get org settings to get blocking severities
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
    columns: {
      blockVehicleOnCriticalDefect: true,
      blockingDefectSeverities: true,
    },
  })

  if (!organisation) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Organisation not found',
    })
  }

  type DefectSeverity = 'minor' | 'major' | 'critical'
  let blockingSeverities: DefectSeverity[]
  try {
    const parsed = JSON.parse(organisation.blockingDefectSeverities) as string[]
    // Filter to only valid severities
    blockingSeverities = parsed.filter((s): s is DefectSeverity =>
      ['minor', 'major', 'critical'].includes(s),
    )
    if (blockingSeverities.length === 0) {
      blockingSeverities = ['critical']
    }
  } catch {
    blockingSeverities = ['critical']
  }

  // Find blocking defects to override
  let defectsToOverride
  if (defectIds && defectIds.length > 0) {
    // Override specific defects
    defectsToOverride = await db.query.defects.findMany({
      where: and(
        eq(schema.defects.assetId, assetId),
        eq(schema.defects.organisationId, user.organisationId),
        inArray(schema.defects.id, defectIds),
        inArray(schema.defects.status, ['open', 'in_progress'] as const),
        inArray(schema.defects.severity, blockingSeverities),
      ),
      columns: {
        id: true,
        title: true,
        severity: true,
      },
    })
  } else {
    // Override all blocking defects for this asset
    defectsToOverride = await db.query.defects.findMany({
      where: and(
        eq(schema.defects.assetId, assetId),
        eq(schema.defects.organisationId, user.organisationId),
        inArray(schema.defects.status, ['open', 'in_progress'] as const),
        inArray(schema.defects.severity, blockingSeverities),
      ),
      columns: {
        id: true,
        title: true,
        severity: true,
      },
    })
  }

  if (defectsToOverride.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No blocking defects found to override',
    })
  }

  const now = new Date()
  const overriddenBlocks: string[] = []
  const createdBlocks: string[] = []

  // Process each blocking defect
  for (const defect of defectsToOverride) {
    // Check if there's an existing active block for this defect
    const existingBlock = await db.query.operationBlocks.findFirst({
      where: and(
        eq(schema.operationBlocks.defectId, defect.id),
        eq(schema.operationBlocks.assetId, assetId),
        eq(schema.operationBlocks.isActive, true),
      ),
      columns: {
        id: true,
      },
    })

    if (existingBlock) {
      // Update existing block with override
      await db
        .update(schema.operationBlocks)
        .set({
          overriddenAt: now,
          overriddenById: user.id,
          overrideReason: reason,
          updatedAt: now,
        })
        .where(eq(schema.operationBlocks.id, existingBlock.id))

      overriddenBlocks.push(existingBlock.id)
    } else {
      // Create new block record with override
      const [newBlock] = await db
        .insert(schema.operationBlocks)
        .values({
          organisationId: user.organisationId,
          assetId: assetId,
          defectId: defect.id,
          blockingSeverity: defect.severity,
          isActive: true,
          blockedAt: now,
          overriddenAt: now,
          overriddenById: user.id,
          overrideReason: reason,
        })
        .returning({ id: schema.operationBlocks.id })

      if (newBlock) {
        createdBlocks.push(newBlock.id)
      }
    }
  }

  // Log in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'override_operation_block',
    entityType: 'operation_block',
    entityId: assetId,
    oldValues: null,
    newValues: {
      assetId,
      assetNumber: asset.assetNumber,
      reason,
      defectsOverridden: defectsToOverride.map((d) => ({
        id: d.id,
        title: d.title,
        severity: d.severity,
      })),
      overriddenBlocks,
      createdBlocks,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: `Successfully overridden ${defectsToOverride.length} blocking defect(s)`,
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
    },
    override: {
      overriddenAt: now.toISOString(),
      overriddenBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      reason,
      defectsOverridden: defectsToOverride.map((d) => ({
        id: d.id,
        title: d.title,
        severity: d.severity,
      })),
    },
  }
})
