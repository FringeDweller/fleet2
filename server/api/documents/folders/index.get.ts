import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const querySchema = z.object({
  // Optional: 'flat' returns all folders, 'tree' returns nested hierarchy
  format: z.enum(['flat', 'tree']).default('flat'),
  // Optional: Only show root folders (no parent)
  rootOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

interface FolderNode {
  id: string
  name: string
  description: string | null
  path: string
  parentId: string | null
  documentCount: number
  createdBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  createdAt: Date
  updatedAt: Date
  children?: FolderNode[]
}

/**
 * GET /api/documents/folders - List all folders with hierarchy
 *
 * Query params:
 * - format: 'flat' (default) returns flat list, 'tree' returns nested hierarchy
 * - rootOnly: 'true' to only return root-level folders
 *
 * Returns all document folders for the organisation with document counts
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const queryResult = querySchema.safeParse(query)

  if (!queryResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: queryResult.error.flatten(),
    })
  }

  const { format, rootOnly } = queryResult.data

  // Build where condition
  const whereCondition = rootOnly
    ? and(
        eq(schema.documentFolders.organisationId, user.organisationId),
        isNull(schema.documentFolders.parentId),
      )
    : eq(schema.documentFolders.organisationId, user.organisationId)

  // Get all folders with document counts
  const folders = await db.query.documentFolders.findMany({
    where: whereCondition,
    with: {
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      documents: {
        columns: { id: true },
      },
    },
    orderBy: (folders, { asc }) => [asc(folders.name)],
  })

  // Transform to include document count
  const foldersWithCounts = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    description: folder.description,
    path: folder.path,
    parentId: folder.parentId,
    documentCount: folder.documents?.length || 0,
    createdBy: folder.createdBy,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }))

  // If tree format requested, build nested structure
  if (format === 'tree') {
    const buildTree = (parentId: string | null): FolderNode[] => {
      return foldersWithCounts
        .filter((f) => f.parentId === parentId)
        .map((f) => ({
          ...f,
          children: buildTree(f.id),
        }))
    }

    return buildTree(null)
  }

  // Return flat list (default)
  return foldersWithCounts
})
