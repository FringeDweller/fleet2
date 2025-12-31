import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const createFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
})

/**
 * POST /api/documents/folders - Create a new document folder
 * Supports creating root folders or subfolders within an existing folder
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

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

  // If parent is specified, verify it exists and build the path
  if (result.data.parentId) {
    const parent = await db.query.documentFolders.findFirst({
      where: and(
        eq(schema.documentFolders.id, result.data.parentId),
        eq(schema.documentFolders.organisationId, session.user.organisationId),
      ),
    })

    if (!parent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Parent folder not found',
      })
    }

    // Build materialized path: parent path + parent id
    path = parent.path.endsWith('/')
      ? `${parent.path}${parent.id}/`
      : `${parent.path}/${parent.id}/`
  }

  const [folder] = await db
    .insert(schema.documentFolders)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId,
      path,
      createdById: session.user.id,
    })
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'document_folder',
    entityId: folder!.id,
    newValues: { name: result.data.name, parentId: result.data.parentId },
  })

  return folder
})
