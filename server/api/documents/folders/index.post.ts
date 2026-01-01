import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters')
    .regex(/^[^<>:"/\\|?*]+$/, 'Name contains invalid characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .nullable(),
  parentId: z.string().uuid('Invalid parent folder ID').optional().nullable(),
})

/**
 * POST /api/documents/folders - Create a new document folder
 *
 * Request body:
 * - name: Folder name (required, 1-255 chars)
 * - description: Optional description (max 1000 chars)
 * - parentId: Optional parent folder UUID for nested folders
 *
 * Supports creating root folders or subfolders within an existing folder.
 * Uses materialized paths for efficient hierarchy queries.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = createFolderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  let path = '/'
  let parentFolder = null

  // If parent is specified, verify it exists and belongs to the organisation
  if (result.data.parentId) {
    parentFolder = await db.query.documentFolders.findFirst({
      where: and(
        eq(schema.documentFolders.id, result.data.parentId),
        eq(schema.documentFolders.organisationId, user.organisationId),
      ),
    })

    if (!parentFolder) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Parent folder not found',
      })
    }

    // Build materialized path: parent path + parent id
    path = parentFolder.path.endsWith('/')
      ? `${parentFolder.path}${parentFolder.id}/`
      : `${parentFolder.path}/${parentFolder.id}/`
  }

  // Check for duplicate folder name in same parent
  const existingFolder = await db.query.documentFolders.findFirst({
    where: and(
      eq(schema.documentFolders.organisationId, user.organisationId),
      eq(schema.documentFolders.name, result.data.name),
      result.data.parentId
        ? eq(schema.documentFolders.parentId, result.data.parentId)
        : eq(schema.documentFolders.parentId, null as unknown as string),
    ),
  })

  if (existingFolder) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A folder with this name already exists in the same location',
    })
  }

  const [folder] = await db
    .insert(schema.documentFolders)
    .values({
      organisationId: user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId,
      path,
      createdById: user.id,
    })
    .returning()

  if (!folder) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create folder',
    })
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'document_folder',
    entityId: folder.id,
    newValues: {
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId,
      path,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  // Return folder with parent info if nested
  return {
    ...folder,
    parent: parentFolder
      ? {
          id: parentFolder.id,
          name: parentFolder.name,
          path: parentFolder.path,
        }
      : null,
  }
})
