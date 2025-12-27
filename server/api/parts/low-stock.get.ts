import { and, eq, isNotNull, or, sql } from 'drizzle-orm'
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
  const includeOnOrder = query.includeOnOrder === 'true'

  // Get parts that are below their reorder threshold
  // A part is low stock if:
  // 1. It has a reorder threshold set
  // 2. Current stock is at or below the threshold
  // 3. (Optional) Not already on order
  const conditions = [
    eq(schema.parts.organisationId, session.user.organisationId),
    eq(schema.parts.isActive, true),
    isNotNull(schema.parts.reorderThreshold),
    sql`CAST(${schema.parts.quantityInStock} AS numeric) <= CAST(${schema.parts.reorderThreshold} AS numeric)`,
  ]

  // If not including on-order parts, filter them out
  if (!includeOnOrder) {
    conditions.push(
      or(
        sql`CAST(${schema.parts.onOrderQuantity} AS numeric) = 0`,
        sql`${schema.parts.onOrderQuantity} IS NULL`,
      )!,
    )
  }

  const lowStockParts = await db.query.parts.findMany({
    where: and(...conditions),
    with: {
      category: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: (parts, { asc }) => [asc(parts.name)],
  })

  // Calculate shortage for each part
  const partsWithShortage = lowStockParts.map((part) => {
    const currentStock = Number.parseFloat(part.quantityInStock)
    const threshold = Number.parseFloat(part.reorderThreshold || '0')
    const reorderQty = Number.parseFloat(part.reorderQuantity || '0')
    const onOrder = Number.parseFloat(part.onOrderQuantity || '0')

    return {
      ...part,
      shortage: Math.max(0, threshold - currentStock),
      suggestedOrder: reorderQty > 0 ? reorderQty : Math.max(0, threshold - currentStock + 10),
      effectiveStock: currentStock + onOrder,
      isOnOrder: onOrder > 0,
    }
  })

  // Summary stats
  const summary = {
    totalLowStock: partsWithShortage.length,
    criticalCount: partsWithShortage.filter((p) => Number.parseFloat(p.quantityInStock) === 0)
      .length,
    onOrderCount: partsWithShortage.filter((p) => p.isOnOrder).length,
    totalShortage: partsWithShortage.reduce((sum, p) => sum + p.shortage, 0),
  }

  return {
    parts: partsWithShortage,
    summary,
  }
})
