import { and, eq, isNull } from 'drizzle-orm'
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
  const includeChildren = query.includeChildren !== 'false'

  // Fetch all groups for the organisation
  const allGroups = await db.query.taskGroups.findMany({
    where: eq(schema.taskGroups.organisationId, session.user.organisationId),
    orderBy: (groups, { asc }) => [asc(groups.sortOrder), asc(groups.name)],
    with: includeChildren
      ? {
          templates: {
            where: eq(schema.taskTemplates.isArchived, false),
            orderBy: (templates, { asc }) => [asc(templates.name)],
          },
        }
      : undefined,
  })

  // If we want a tree structure, organize into hierarchy
  if (includeChildren) {
    const groupMap = new Map(allGroups.map((g) => [g.id, { ...g, children: [] as any[] }]))
    const rootGroups: any[] = []

    for (const group of allGroups) {
      const groupWithChildren = groupMap.get(group.id)!

      if (group.parentId) {
        const parent = groupMap.get(group.parentId)
        if (parent) {
          parent.children.push(groupWithChildren)
        } else {
          // Parent doesn't exist, treat as root
          rootGroups.push(groupWithChildren)
        }
      } else {
        rootGroups.push(groupWithChildren)
      }
    }

    return rootGroups
  }

  return allGroups
})
