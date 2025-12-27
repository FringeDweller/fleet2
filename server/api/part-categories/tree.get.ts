import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

interface CategoryNode {
  id: string
  name: string
  description: string | null
  children: CategoryNode[]
  partCount?: number
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Get all active categories for this organisation
  const categories = await db.query.partCategories.findMany({
    where: and(
      eq(schema.partCategories.organisationId, session.user.organisationId),
      eq(schema.partCategories.isActive, true),
    ),
    with: {
      parts: {
        where: eq(schema.parts.isActive, true),
        columns: { id: true },
      },
    },
    orderBy: (categories, { asc }) => [asc(categories.name)],
  })

  // Build tree structure
  const buildTree = (parentId: string | null): CategoryNode[] => {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        partCount: c.parts?.length || 0,
        children: buildTree(c.id),
      }))
  }

  return buildTree(null)
})
