/**
 * POST /api/obd/dtc/process
 *
 * Process detected DTCs and create work orders if rules match.
 * Called after reading DTCs from an OBD device.
 */

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { processMultipleDtcs } from '../../../utils/dtc-work-order-service'
import { requireAuth } from '../../../utils/permissions'

const dtcSchema = z.object({
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional().nullable(),
  severity: z.enum(['critical', 'severe', 'moderate', 'minor', 'unknown']).optional(),
  isPending: z.boolean().optional(),
  isConfirmed: z.boolean().optional(),
})

const processDtcSchema = z.object({
  assetId: z.string().uuid(),
  dtcs: z.array(dtcSchema).min(1).max(50),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = processDtcSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { assetId, dtcs } = result.data

  // Verify asset belongs to organisation
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

  // Process all DTCs
  const results = await processMultipleDtcs(
    user.organisationId,
    assetId,
    dtcs.map((dtc) => ({
      code: dtc.code,
      description: dtc.description || undefined,
      severity: dtc.severity,
      isPending: dtc.isPending,
      isConfirmed: dtc.isConfirmed,
    })),
    user.id,
  )

  // Summarize results
  const summary = {
    total: results.length,
    created: results.filter((r) => r.action === 'created').length,
    skipped: results.filter((r) => r.action === 'skipped').length,
    duplicates: results.filter((r) => r.action === 'duplicate').length,
    noRule: results.filter((r) => r.action === 'no_rule').length,
    errors: results.filter((r) => r.action === 'error').length,
  }

  return {
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
    },
    results,
    summary,
    message:
      summary.created > 0
        ? `Created ${summary.created} work order(s) from ${summary.total} DTC(s)`
        : `Processed ${summary.total} DTC(s), no work orders created`,
  }
})
