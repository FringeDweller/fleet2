import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

const resolveSchema = z.object({
  // Notes explaining the resolution
  resolutionNotes: z.string().min(1, 'Resolution notes are required').max(1000),
})

/**
 * Resolve a fuel transaction discrepancy
 *
 * POST /api/fuel/discrepancies/:id/resolve
 *
 * Requires: reports:write permission
 */
export default defineEventHandler(async (event) => {
  // Require reports:write permission
  const user = await requirePermission(event, 'reports:write')

  const transactionId = getRouterParam(event, 'id')
  if (!transactionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID is required',
    })
  }

  const body = await readBody(event)
  const result = resolveSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Find the transaction
  const transaction = await db.query.fuelTransactions.findFirst({
    where: and(
      eq(schema.fuelTransactions.id, transactionId),
      eq(schema.fuelTransactions.organisationId, user.organisationId),
    ),
    columns: {
      id: true,
      hasDiscrepancy: true,
      discrepancyType: true,
      discrepancyDetails: true,
      discrepancyResolvedAt: true,
    },
  })

  if (!transaction) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fuel transaction not found',
    })
  }

  if (!transaction.hasDiscrepancy) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This transaction does not have a discrepancy to resolve',
    })
  }

  if (transaction.discrepancyResolvedAt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This discrepancy has already been resolved',
    })
  }

  // Update the transaction to mark discrepancy as resolved
  await db
    .update(schema.fuelTransactions)
    .set({
      discrepancyResolvedAt: new Date(),
      discrepancyResolvedById: user.id,
      discrepancyResolutionNotes: data.resolutionNotes,
      updatedAt: new Date(),
    })
    .where(eq(schema.fuelTransactions.id, transactionId))

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'fuel_discrepancy_resolved',
    entityType: 'fuel_transaction',
    entityId: transactionId,
    oldValues: {
      discrepancyType: transaction.discrepancyType,
      discrepancyDetails: transaction.discrepancyDetails,
    },
    newValues: {
      resolutionNotes: data.resolutionNotes,
      resolvedAt: new Date().toISOString(),
    },
  })

  return {
    success: true,
    transactionId,
    discrepancyType: transaction.discrepancyType,
    resolvedAt: new Date().toISOString(),
    resolvedBy: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
    },
    message: 'Discrepancy resolved successfully.',
  }
})
