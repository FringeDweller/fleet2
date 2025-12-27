import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Get parts at or below reorder threshold
  const lowStockParts = await db.query.parts.findMany({
    where: and(
      eq(schema.parts.organisationId, session.user.organisationId),
      eq(schema.parts.isActive, true),
      sql`${schema.parts.reorderThreshold} IS NOT NULL`,
      sql`CAST(${schema.parts.quantityInStock} AS NUMERIC) <= CAST(${schema.parts.reorderThreshold} AS NUMERIC)`,
    ),
    with: {
      category: true,
    },
    orderBy: (parts, { asc }) => [
      asc(
        sql`CAST(${parts.quantityInStock} AS NUMERIC) / NULLIF(CAST(${parts.reorderThreshold} AS NUMERIC), 0)`,
      ),
    ],
  })

  return lowStockParts.map((part) => ({
    ...part,
    stockLevel: parseFloat(part.quantityInStock),
    threshold: parseFloat(part.reorderThreshold || '0'),
    percentOfThreshold:
      part.reorderThreshold && parseFloat(part.reorderThreshold) > 0
        ? Math.round((parseFloat(part.quantityInStock) / parseFloat(part.reorderThreshold)) * 100)
        : null,
    suggestedReorderQty: part.reorderQuantity ? parseFloat(part.reorderQuantity) : null,
  }))
})
