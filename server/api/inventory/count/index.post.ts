import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const startCountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  notes: z.string().optional(),
  partIds: z.array(z.string().uuid()).optional(),
})

/**
 * Start a new inventory count session
 * REQ-606-AC-01: Start inventory count session
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = startCountSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Create the inventory count session
  const [countSession] = await db
    .insert(schema.inventoryCountSessions)
    .values({
      organisationId: session.user.organisationId,
      name: data.name || `Inventory Count ${new Date().toISOString().split('T')[0]}`,
      notes: data.notes,
      startedById: session.user.id,
      status: 'in_progress',
    })
    .returning()

  if (!countSession) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create inventory count session',
    })
  }

  // Get all parts or specific parts for counting
  const partsQuery = db.query.parts.findMany({
    where: (parts, { eq, and, inArray }) =>
      and(
        eq(parts.organisationId, session.user!.organisationId),
        eq(parts.isActive, true),
        data.partIds && data.partIds.length > 0 ? inArray(parts.id, data.partIds) : undefined,
      ),
    columns: {
      id: true,
      sku: true,
      name: true,
      quantityInStock: true,
      location: true,
    },
  })

  const parts = await partsQuery

  // Create count items for each part
  if (parts.length > 0) {
    await db.insert(schema.inventoryCountItems).values(
      parts.map((part) => ({
        sessionId: countSession.id,
        partId: part.id,
        location: part.location,
        systemQuantity: part.quantityInStock,
        status: 'pending' as const,
      })),
    )
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'inventory_count_session',
    entityId: countSession.id,
    newValues: countSession,
  })

  return {
    ...countSession,
    itemsCount: parts.length,
  }
})
