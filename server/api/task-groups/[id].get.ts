import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Group ID is required',
    })
  }

  const group = await db.query.taskGroups.findFirst({
    where: and(
      eq(schema.taskGroups.id, id),
      eq(schema.taskGroups.organisationId, session.user.organisationId),
    ),
    with: {
      children: {
        orderBy: (groups, { asc }) => [asc(groups.sortOrder), asc(groups.name)],
      },
      templates: {
        where: eq(schema.taskTemplates.isArchived, false),
        orderBy: (templates, { asc }) => [asc(templates.name)],
      },
    },
  })

  if (!group) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task group not found',
    })
  }

  return group
})
