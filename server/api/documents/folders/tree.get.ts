import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

interface FolderNode {
  id: string
  name: string
  description: string | null
  path: string
  children: FolderNode[]
  documentCount?: number
}

/**
 * GET /api/documents/folders/tree - Get folder tree structure
 * Returns the complete folder hierarchy as a nested tree
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Get all folders for this organisation with document counts
  const folders = await db.query.documentFolders.findMany({
    where: eq(schema.documentFolders.organisationId, session.user.organisationId),
    with: {
      documents: {
        columns: { id: true },
      },
    },
    orderBy: (folders, { asc }) => [asc(folders.name)],
  })

  // Build tree structure
  const buildTree = (parentId: string | null): FolderNode[] => {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        path: f.path,
        documentCount: f.documents?.length || 0,
        children: buildTree(f.id),
      }))
  }

  return buildTree(null)
})
