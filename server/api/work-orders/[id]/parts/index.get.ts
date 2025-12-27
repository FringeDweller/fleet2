import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  const parts = await db.query.workOrderParts.findMany({
    where: eq(schema.workOrderParts.workOrderId, id),
    with: {
      addedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      // Include linked inventory part details for stock tracking
      part: {
        columns: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          quantityInStock: true,
          unitCost: true,
          isActive: true,
        },
      },
    },
    orderBy: (parts, { desc }) => [desc(parts.createdAt)],
  })

  // Transform to include availability info
  return parts.map((p) => ({
    ...p,
    // Calculate availability if linked to inventory
    availability: p.part
      ? {
          inStock: parseFloat(p.part.quantityInStock) >= p.quantity,
          available: parseFloat(p.part.quantityInStock),
          needed: p.quantity,
          unit: p.part.unit,
        }
      : null,
  }))
})
