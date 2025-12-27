import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const createPartSchema = z.object({
  // Optional link to parts inventory - when provided, auto-populates fields
  partId: z.string().uuid().optional().nullable(),
  // These fields are optional when partId is provided (will be auto-populated from inventory)
  partName: z.string().min(1).max(200).optional(),
  partNumber: z.string().max(100).optional().nullable(),
  quantity: z.number().int().positive().default(1),
  unitCost: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
})

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

  const body = await readBody(event)
  const result = createPartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true, status: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Don't allow adding parts to completed/closed work orders
  if (workOrder.status === 'completed' || workOrder.status === 'closed') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot add parts to completed or closed work orders',
    })
  }

  // If partId is provided, fetch part details from inventory
  let partName = result.data.partName
  let partNumber = result.data.partNumber
  let unitCost = result.data.unitCost
  const partId = result.data.partId
  let inventoryPart: { quantityInStock: string; unit: string } | null = null

  if (partId) {
    const part = await db.query.parts.findFirst({
      where: and(
        eq(schema.parts.id, partId),
        eq(schema.parts.organisationId, session.user.organisationId),
        eq(schema.parts.isActive, true),
      ),
      columns: {
        id: true,
        name: true,
        sku: true,
        unitCost: true,
        quantityInStock: true,
        unit: true,
      },
    })

    if (!part) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Part not found in inventory',
      })
    }

    // Auto-populate from inventory (can be overridden by explicit values)
    partName = partName || part.name
    partNumber = partNumber ?? part.sku
    unitCost = unitCost ?? (part.unitCost ? parseFloat(part.unitCost) : null)
    inventoryPart = {
      quantityInStock: part.quantityInStock,
      unit: part.unit,
    }
  }

  // Validate that we have a part name (required)
  if (!partName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part name is required when not selecting from inventory',
    })
  }

  // Calculate total cost
  const totalCost = unitCost ? (unitCost * result.data.quantity).toFixed(2) : null

  const [insertedPart] = await db
    .insert(schema.workOrderParts)
    .values({
      workOrderId: id,
      partId: partId || null,
      partName,
      partNumber,
      quantity: result.data.quantity,
      unitCost: unitCost?.toFixed(2),
      totalCost,
      notes: result.data.notes,
      addedById: session.user.id,
    })
    .returning()

  if (!insertedPart) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add part',
    })
  }

  // Return with inventory info if linked
  return {
    ...insertedPart,
    inventoryPart,
  }
})
