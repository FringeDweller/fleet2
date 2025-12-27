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

  const templateId = getRouterParam(event, 'id')

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  // Verify template exists and belongs to organisation
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Get template parts with full part details
  const templateParts = await db.query.taskTemplateParts.findMany({
    where: eq(schema.taskTemplateParts.templateId, templateId),
    with: {
      part: {
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: (tp) => tp.createdAt,
  })

  // Calculate totals
  let totalEstimatedCost = 0
  const parts = templateParts.map((tp) => {
    const unitCost = tp.part.unitCost ? parseFloat(tp.part.unitCost) : 0
    const quantity = parseFloat(tp.quantity)
    const lineCost = unitCost * quantity
    totalEstimatedCost += lineCost

    return {
      id: tp.id,
      templateId: tp.templateId,
      partId: tp.partId,
      quantity: tp.quantity,
      notes: tp.notes,
      createdAt: tp.createdAt,
      updatedAt: tp.updatedAt,
      part: {
        id: tp.part.id,
        sku: tp.part.sku,
        name: tp.part.name,
        description: tp.part.description,
        unit: tp.part.unit,
        unitCost: tp.part.unitCost,
        quantityInStock: tp.part.quantityInStock,
        supplier: tp.part.supplier,
        location: tp.part.location,
        isActive: tp.part.isActive,
        category: tp.part.category,
      },
      lineCost: lineCost.toFixed(2),
      inStock: parseFloat(tp.part.quantityInStock) >= quantity,
    }
  })

  return {
    data: parts,
    summary: {
      totalParts: parts.length,
      totalEstimatedCost: totalEstimatedCost.toFixed(2),
      allInStock: parts.every((p) => p.inStock),
    },
  }
})
