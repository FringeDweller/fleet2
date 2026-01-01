import { eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

interface FolderNode {
  id: string
  name: string
  description: string | null
  path: string
  parentId: string | null
  documentCount: number
  createdAt: Date
  children: FolderNode[]
}

/**
 * GET /api/documents/folders/tree - Get folder tree structure
 * Returns the complete folder hierarchy as a nested tree with document counts
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Get all folders for this organisation with document counts
  const folders = await db.query.documentFolders.findMany({
    where: eq(schema.documentFolders.organisationId, user.organisationId),
    with: {
      documents: {
        columns: { id: true },
      },
    },
    orderBy: (folders, { asc }) => [asc(folders.name)],
  })

  // Build tree structure recursively
  const buildTree = (parentId: string | null): FolderNode[] => {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        path: f.path,
        parentId: f.parentId,
        documentCount: f.documents?.length || 0,
        createdAt: f.createdAt,
        children: buildTree(f.id),
      }))
  }

  return buildTree(null)
})
