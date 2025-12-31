/**
 * Clear DTCs endpoint (US-10.4)
 *
 * Clears (marks as resolved) DTCs for an asset.
 * Requires a work order reference and logs the clearing action.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

interface ClearDtcPayload {
  assetId: string
  workOrderId: string
  offlineTimestamp?: string
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Store user reference after auth check
  const user = session.user

  const body = await readBody<ClearDtcPayload>(event)

  if (!body.assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  if (!body.workOrderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order reference is required to clear DTCs',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, body.assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, body.workOrderId),
      eq(schema.workOrders.organisationId, user.organisationId),
    ),
    columns: { id: true, workOrderNumber: true, status: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Get all active (non-cleared) DTCs for this asset
  const activeCodes = await db.query.diagnosticCodes.findMany({
    where: and(
      eq(schema.diagnosticCodes.assetId, body.assetId),
      isNull(schema.diagnosticCodes.clearedAt),
    ),
  })

  if (activeCodes.length === 0) {
    return {
      success: true,
      clearedCount: 0,
      message: 'No active DTCs to clear',
    }
  }

  // Determine clear timestamp (for offline sync support)
  const clearedAt = body.offlineTimestamp ? new Date(body.offlineTimestamp) : new Date()

  // Mark all active DTCs as cleared
  const clearedCodes = await Promise.all(
    activeCodes.map(async (code) => {
      const [updated] = await db
        .update(schema.diagnosticCodes)
        .set({
          clearedAt,
          clearedByUserId: user.id,
          workOrderId: body.workOrderId,
          updatedAt: new Date(),
        })
        .where(eq(schema.diagnosticCodes.id, code.id))
        .returning()

      return updated
    }),
  )

  // Log the action to audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'dtc_clear',
    entityType: 'asset',
    entityId: body.assetId,
    newValues: {
      clearedCount: clearedCodes.length,
      codes: activeCodes.map((c) => c.code),
      workOrderId: body.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      assetNumber: asset.assetNumber,
    },
    ipAddress: getRequestIP(event) ?? null,
    userAgent: getRequestHeader(event, 'user-agent') ?? null,
  })

  return {
    success: true,
    clearedCount: clearedCodes.length,
    message: `${clearedCodes.length} diagnostic code(s) cleared`,
  }
})
