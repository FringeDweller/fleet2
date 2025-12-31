import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

/**
 * GET /api/documents/folders/[id] - Get a specific folder with its children and documents
 * Returns folder details, child folders, and documents in this folder
 */
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
      statusMessage: 'Folder ID is required',
    })
  }

  const folder = await db.query.documentFolders.findFirst({
    where: and(
      eq(schema.documentFolders.id, id),
      eq(schema.documentFolders.organisationId, session.user.organisationId),
    ),
    with: {
      parent: {
        columns: {
          id: true,
          name: true,
          path: true,
        },
      },
      children: {
        orderBy: (folders, { asc }) => [asc(folders.name)],
        with: {
          documents: {
            columns: { id: true },
          },
        },
      },
      documents: {
        orderBy: (docs, { asc }) => [asc(docs.name)],
        with: {
          uploadedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!folder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Folder not found',
    })
  }

  // Add document counts to children
  const childrenWithCounts = folder.children.map((child) => ({
    ...child,
    documentCount: child.documents?.length || 0,
    documents: undefined, // Remove documents array, keep count only
  }))

  return {
    ...folder,
    children: childrenWithCounts,
  }
})
