/**
 * US-9.6: Vehicle Operation Status API
 * Returns whether a vehicle can be operated based on blocking defects and org settings
 */
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to user's organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      assetNumber: true,
      status: true,
    },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get organisation settings
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

  // If blocking is disabled, vehicle can always operate
  if (!organisation.blockVehicleOnCriticalDefect) {
    return {
      canOperate: true,
      isBlocked: false,
      blockingDefects: [],
      activeBlocks: [],
      message: null,
      asset: {
        id: asset.id,
        assetNumber: asset.assetNumber,
        status: asset.status,
      },
    }
  }

  // Parse blocking severities from org settings
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

  // Find active blocking defects (open/in_progress defects with blocking severity)
  const blockingDefects = await db.query.defects.findMany({
    where: and(
      eq(schema.defects.assetId, assetId),
      eq(schema.defects.organisationId, user.organisationId),
      inArray(schema.defects.status, ['open', 'in_progress'] as const),
      inArray(schema.defects.severity, blockingSeverities),
    ),
    columns: {
      id: true,
      title: true,
      description: true,
      severity: true,
      status: true,
      category: true,
      reportedAt: true,
    },
    with: {
      reportedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (defects, { desc }) => [desc(defects.reportedAt)],
  })

  // Find active blocks (not overridden and still active)
  const activeBlocks = await db.query.operationBlocks.findMany({
    where: and(
      eq(schema.operationBlocks.assetId, assetId),
      eq(schema.operationBlocks.organisationId, user.organisationId),
      eq(schema.operationBlocks.isActive, true),
    ),
    columns: {
      id: true,
      blockingSeverity: true,
      blockedAt: true,
      overriddenAt: true,
      overrideReason: true,
    },
    with: {
      defect: {
        columns: {
          id: true,
          title: true,
          severity: true,
        },
      },
      overriddenBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (blocks, { desc }) => [desc(blocks.blockedAt)],
  })

  // Check for any active override - if block is overridden, vehicle can operate
  const hasActiveOverride = activeBlocks.some((block) => block.overriddenAt !== null)

  // Determine if vehicle is blocked
  // Vehicle is blocked if there are blocking defects AND no active override
  const isBlocked = blockingDefects.length > 0 && !hasActiveOverride

  // Build message
  let message: string | null = null
  if (isBlocked) {
    const criticalCount = blockingDefects.filter((d) => d.severity === 'critical').length
    const majorCount = blockingDefects.filter((d) => d.severity === 'major').length

    if (criticalCount > 0 && majorCount > 0) {
      message = `NOT SAFE TO OPERATE: ${criticalCount} critical and ${majorCount} major defect(s) require attention`
    } else if (criticalCount > 0) {
      message = `NOT SAFE TO OPERATE: ${criticalCount} critical defect(s) require attention`
    } else if (majorCount > 0) {
      message = `OPERATION BLOCKED: ${majorCount} major defect(s) require attention`
    } else {
      message = `OPERATION BLOCKED: ${blockingDefects.length} defect(s) require attention`
    }
  } else if (hasActiveOverride) {
    const latestOverride = activeBlocks.find((b) => b.overriddenAt)
    if (latestOverride?.overriddenBy) {
      message = `Operation authorized by ${latestOverride.overriddenBy.firstName} ${latestOverride.overriddenBy.lastName}`
    } else {
      message = 'Operation authorized by supervisor override'
    }
  }

  return {
    canOperate: !isBlocked,
    isBlocked,
    hasActiveOverride,
    blockingDefects: blockingDefects.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      severity: d.severity,
      status: d.status,
      category: d.category,
      reportedAt: d.reportedAt,
      reportedBy: d.reportedBy,
    })),
    activeBlocks: activeBlocks.map((b) => ({
      id: b.id,
      blockingSeverity: b.blockingSeverity,
      blockedAt: b.blockedAt,
      overriddenAt: b.overriddenAt,
      overrideReason: b.overrideReason,
      defect: b.defect,
      overriddenBy: b.overriddenBy,
    })),
    message,
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      status: asset.status,
    },
    settings: {
      blockingEnabled: organisation.blockVehicleOnCriticalDefect,
      blockingSeverities,
    },
  }
})
