import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

interface CategoryNode {
  id: string
  name: string
  description: string | null
  parentId: string | null
  defaultMaintenanceSchedules: unknown[]
  defaultParts: unknown[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  assetCount: number
  children: CategoryNode[]
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const includeInactive = query.includeInactive === 'true'

  // Get all categories for this org
  const conditions = [eq(schema.assetCategories.organisationId, session.user.organisationId)]
  if (!includeInactive) {
    conditions.push(eq(schema.assetCategories.isActive, true))
  }

  const allCategories = await db.query.assetCategories.findMany({
    where: and(...conditions),
    orderBy: (categories, { asc }) => [asc(categories.name)],
  })

  // Get asset counts per category
  const assetCounts = await db
    .select({
      categoryId: schema.assets.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.organisationId, session.user.organisationId),
        eq(schema.assets.isArchived, false),
      ),
    )
    .groupBy(schema.assets.categoryId)

  const countMap = new Map(assetCounts.map((c) => [c.categoryId, c.count]))

  // Build tree structure
  const categoryMap = new Map<string, CategoryNode>()

  // First pass: create all nodes
  for (const cat of allCategories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      parentId: cat.parentId,
      defaultMaintenanceSchedules: (cat.defaultMaintenanceSchedules as unknown[]) || [],
      defaultParts: (cat.defaultParts as unknown[]) || [],
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      assetCount: countMap.get(cat.id) || 0,
      children: [],
    })
  }

  // Second pass: build parent-child relationships
  const rootCategories: CategoryNode[] = []

  for (const cat of allCategories) {
    const node = categoryMap.get(cat.id)!
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node)
    } else {
      rootCategories.push(node)
    }
  }

  return rootCategories
})
