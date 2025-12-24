import { db, schema } from '../../utils/db'
import { eq, and, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const search = query.search as string | undefined
  const status = query.status as string | undefined
  const categoryId = query.categoryId as string | undefined
  const includeArchived = query.includeArchived === 'true'

  const conditions = [eq(schema.assets.organisationId, session.user.organisationId)]

  if (!includeArchived) {
    conditions.push(eq(schema.assets.isArchived, false))
  }

  if (status && ['active', 'inactive', 'maintenance', 'disposed'].includes(status)) {
    conditions.push(eq(schema.assets.status, status as 'active' | 'inactive' | 'maintenance' | 'disposed'))
  }

  if (categoryId) {
    conditions.push(eq(schema.assets.categoryId, categoryId))
  }

  if (search) {
    conditions.push(
      or(
        ilike(schema.assets.assetNumber, `%${search}%`),
        ilike(schema.assets.vin, `%${search}%`),
        ilike(schema.assets.make, `%${search}%`),
        ilike(schema.assets.model, `%${search}%`),
        ilike(schema.assets.licensePlate, `%${search}%`)
      )!
    )
  }

  const assets = await db.query.assets.findMany({
    where: and(...conditions),
    with: {
      category: true
    },
    orderBy: (assets, { desc }) => [desc(assets.createdAt)]
  })

  return assets
})
