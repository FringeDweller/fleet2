import { and, eq } from 'drizzle-orm'
import { CacheTTL, cachedList } from '../../utils/cache'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const orgId = session.user.organisationId

  // US-18.1.1: Cache part categories (stable reference data)
  const categories = await cachedList(
    'part-categories',
    orgId,
    { active: true },
    async () => {
      return await db.query.partCategories.findMany({
        where: and(
          eq(schema.partCategories.organisationId, orgId),
          eq(schema.partCategories.isActive, true),
        ),
        orderBy: (categories, { asc }) => [asc(categories.name)],
      })
    },
    { ttl: CacheTTL.EXTENDED, staleTtl: 60 },
  )

  return categories
})
