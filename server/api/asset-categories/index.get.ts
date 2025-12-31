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

  // US-18.1.1: Cache asset categories (stable reference data)
  // TTL: 15 minutes since categories rarely change
  const categories = await cachedList(
    'asset-categories',
    orgId,
    { active: true },
    async () => {
      return await db.query.assetCategories.findMany({
        where: and(
          eq(schema.assetCategories.organisationId, orgId),
          eq(schema.assetCategories.isActive, true),
        ),
        orderBy: (categories, { asc }) => [asc(categories.name)],
      })
    },
    { ttl: CacheTTL.EXTENDED, staleTtl: 60 },
  )

  return categories
})
