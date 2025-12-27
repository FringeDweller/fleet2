import { db, schema } from '../../utils/db'
import { eq, and, ilike } from 'drizzle-orm'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
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
    orderBy: (templates, { asc }) => [asc(templates.name)]
  })

  return templates
})
