import { and, eq, ilike } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const includeArchived = query.includeArchived === 'true'
  const activeOnly = query.activeOnly === 'true'

  const conditions = [eq(schema.taskTemplates.organisationId, session.user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.taskTemplates.isArchived, false))
  }

  if (activeOnly) {
    conditions.push(eq(schema.taskTemplates.isActive, true))
  }

  if (search) {
    conditions.push(ilike(schema.taskTemplates.name, `%${search}%`))
  }

  const templates = await db.query.taskTemplates.findMany({
    where: and(...conditions),
    orderBy: (templates, { asc }) => [asc(templates.name)],
    with: {
      templateParts: {
        with: {
          part: true,
        },
      },
    },
  })

  // Calculate parts summary for each template
  return templates.map((template) => {
    let totalPartsCost = 0
    let allInStock = true

    const partsWithDetails = template.templateParts.map((tp) => {
      const unitCost = tp.part.unitCost ? parseFloat(tp.part.unitCost) : 0
      const quantity = parseFloat(tp.quantity)
      const lineCost = unitCost * quantity
      totalPartsCost += lineCost

      const inStock = parseFloat(tp.part.quantityInStock) >= quantity
      if (!inStock) allInStock = false

      return {
        id: tp.id,
        partId: tp.partId,
        quantity: tp.quantity,
        part: {
          id: tp.part.id,
          sku: tp.part.sku,
          name: tp.part.name,
          unit: tp.part.unit,
          unitCost: tp.part.unitCost,
          quantityInStock: tp.part.quantityInStock,
        },
        lineCost: lineCost.toFixed(2),
        inStock,
      }
    })

    return {
      ...template,
      templateParts: partsWithDetails,
      partsSummary: {
        totalParts: partsWithDetails.length,
        totalPartsCost: totalPartsCost.toFixed(2),
        allInStock: partsWithDetails.length === 0 || allInStock,
      },
    }
  })
})
