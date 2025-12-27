import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const updatePartSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unit: z
    .enum(['each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair'])
    .optional(),
  minimumStock: z.number().min(0).optional().nullable(),
  reorderThreshold: z.number().min(0).optional().nullable(),
  reorderQuantity: z.number().min(0).optional().nullable(),
  unitCost: z.number().min(0).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  supplierPartNumber: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Part ID is required'
    })
  }

  const body = await readBody(event)
  const result = updatePartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify part exists and belongs to org
  const existing = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, id),
      eq(schema.parts.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found'
    })
  }

  // Verify category exists if provided
  if (result.data.categoryId) {
    const category = await db.query.partCategories.findFirst({
      where: and(
        eq(schema.partCategories.id, result.data.categoryId),
        eq(schema.partCategories.organisationId, session.user.organisationId)
      )
    })

    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category not found'
      })
    }
  }

  // Check for duplicate SKU if changing
  if (result.data.sku && result.data.sku !== existing.sku) {
    const duplicateSku = await db.query.parts.findFirst({
      where: and(
        eq(schema.parts.organisationId, session.user.organisationId),
        eq(schema.parts.sku, result.data.sku)
      )
    })

    if (duplicateSku) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A part with this SKU already exists'
      })
    }
  }

  // Prepare update values, converting numbers to strings for decimals
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (result.data.sku !== undefined) updateValues.sku = result.data.sku
  if (result.data.name !== undefined) updateValues.name = result.data.name
  if (result.data.description !== undefined) updateValues.description = result.data.description
  if (result.data.categoryId !== undefined) updateValues.categoryId = result.data.categoryId
  if (result.data.unit !== undefined) updateValues.unit = result.data.unit
  if (result.data.minimumStock !== undefined)
    updateValues.minimumStock = result.data.minimumStock?.toString() ?? null
  if (result.data.reorderThreshold !== undefined)
    updateValues.reorderThreshold = result.data.reorderThreshold?.toString() ?? null
  if (result.data.reorderQuantity !== undefined)
    updateValues.reorderQuantity = result.data.reorderQuantity?.toString() ?? null
  if (result.data.unitCost !== undefined)
    updateValues.unitCost = result.data.unitCost?.toString() ?? null
  if (result.data.supplier !== undefined) updateValues.supplier = result.data.supplier
  if (result.data.supplierPartNumber !== undefined)
    updateValues.supplierPartNumber = result.data.supplierPartNumber
  if (result.data.location !== undefined) updateValues.location = result.data.location
  if (result.data.isActive !== undefined) updateValues.isActive = result.data.isActive

  const [updated] = await db
    .update(schema.parts)
    .set(updateValues)
    .where(eq(schema.parts.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'part',
    entityId: id,
    oldValues: { sku: existing.sku, name: existing.name },
    newValues: result.data
  })

  return updated
})
