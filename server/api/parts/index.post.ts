import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const createPartSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unit: z
    .enum(['each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair'])
    .default('each'),
  quantityInStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).optional(),
  reorderThreshold: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  supplierPartNumber: z.string().max(100).optional(),
  location: z.string().max(100).optional()
})

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createPartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
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

  // Check for duplicate SKU in organisation
  const existingSku = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.organisationId, session.user.organisationId),
      eq(schema.parts.sku, result.data.sku)
    )
  })

  if (existingSku) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A part with this SKU already exists'
    })
  }

  const [part] = await db
    .insert(schema.parts)
    .values({
      organisationId: session.user.organisationId,
      sku: result.data.sku,
      name: result.data.name,
      description: result.data.description,
      categoryId: result.data.categoryId,
      unit: result.data.unit,
      quantityInStock: result.data.quantityInStock.toString(),
      minimumStock: result.data.minimumStock?.toString(),
      reorderThreshold: result.data.reorderThreshold?.toString(),
      reorderQuantity: result.data.reorderQuantity?.toString(),
      unitCost: result.data.unitCost?.toString(),
      supplier: result.data.supplier,
      supplierPartNumber: result.data.supplierPartNumber,
      location: result.data.location
    })
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'part',
    entityId: part!.id,
    newValues: { sku: result.data.sku, name: result.data.name }
  })

  return part
})
