import { and, eq, like } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
})

/**
 * PUT /api/documents/folders/[id] - Update a folder (rename or move)
 * Supports renaming and moving folders to a different parent
 * Updates materialized paths for moved folders and all descendants
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

  const body = await readBody(event)
  const result = updateFolderSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify folder exists and belongs to org
  const existing = await db.query.documentFolders.findFirst({
    where: and(
      eq(schema.documentFolders.id, id),
      eq(schema.documentFolders.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Folder not found',
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.name !== undefined) {
    updateData.name = result.data.name
  }

  if (result.data.description !== undefined) {
    updateData.description = result.data.description
  }

  // Handle moving folder to a different parent
  if (result.data.parentId !== undefined && result.data.parentId !== existing.parentId) {
    // Prevent setting self as parent
    if (result.data.parentId === id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Folder cannot be its own parent',
      })
    }

    let newPath = '/'

    if (result.data.parentId) {
      // Verify new parent exists
      const newParent = await db.query.documentFolders.findFirst({
        where: and(
          eq(schema.documentFolders.id, result.data.parentId),
          eq(schema.documentFolders.organisationId, session.user.organisationId),
        ),
      })

      if (!newParent) {
        throw createError({
          statusCode: 400,
          statusMessage: 'New parent folder not found',
        })
      }

      // Prevent moving folder into its own descendant (would create cycle)
      if (newParent.path.includes(`/${id}/`) || newParent.path.endsWith(`/${id}`)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot move folder into its own descendant',
        })
      }

      newPath = newParent.path.endsWith('/')
        ? `${newParent.path}${newParent.id}/`
        : `${newParent.path}/${newParent.id}/`
    }

    updateData.parentId = result.data.parentId
    updateData.path = newPath

    // Update all descendants' paths
    const oldPathPrefix = existing.path.endsWith('/')
      ? `${existing.path}${id}/`
      : `${existing.path}/${id}/`
    const newPathPrefix = newPath.endsWith('/') ? `${newPath}${id}/` : `${newPath}/${id}/`

    // Find all descendants (folders whose path starts with old path prefix)
    const descendants = await db.query.documentFolders.findMany({
      where: and(
        eq(schema.documentFolders.organisationId, session.user.organisationId),
        like(schema.documentFolders.path, `${oldPathPrefix}%`),
      ),
    })

    // Update each descendant's path
    for (const descendant of descendants) {
      const updatedPath = descendant.path.replace(oldPathPrefix, newPathPrefix)
      await db
        .update(schema.documentFolders)
        .set({ path: updatedPath, updatedAt: new Date() })
        .where(eq(schema.documentFolders.id, descendant.id))
    }
  }

  const [updated] = await db
    .update(schema.documentFolders)
    .set(updateData)
    .where(eq(schema.documentFolders.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'document_folder',
    entityId: id,
    oldValues: { name: existing.name, parentId: existing.parentId },
    newValues: result.data,
  })

  return updated
})
