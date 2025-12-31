import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/documents/folders - List root folders (folders with no parent)
 * Returns all root-level document folders for the organisation
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const folders = await db.query.documentFolders.findMany({
    where: and(
      eq(schema.documentFolders.organisationId, session.user.organisationId),
      isNull(schema.documentFolders.parentId),
    ),
    with: {
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (folders, { asc }) => [asc(folders.name)],
  })

  return folders
})
