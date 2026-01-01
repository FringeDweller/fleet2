import { and, eq, like } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

const querySchema = z.object({
  mode: z.enum(['cascade', 'move']).default('move'),
  targetFolderId: z.string().uuid('Invalid target folder ID').optional(),
})

/**
 * DELETE /api/documents/folders/[id] - Delete a folder
 *
 * Query params:
 * - mode: 'cascade' (delete all contents) or 'move' (move contents to target/root)
 * - targetFolderId: Where to move contents when mode is 'move' (optional, defaults to root)
 *
 * When mode is 'move' (default):
 * - Child folders are moved to the target folder or root
 * - Documents in this folder are moved to the target folder or root
 *
 * When mode is 'cascade':
 * - All descendant folders are deleted
 * - Documents are orphaned (folderId set to null per schema onDelete: 'set null')
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder ID is required',
    })
  }

  const query = getQuery(event)
  const queryResult = querySchema.safeParse(query)

  if (!queryResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: queryResult.error.flatten(),
    })
  }

  const { mode, targetFolderId } = queryResult.data

  // Verify folder exists and belongs to org
  const folder = await db.query.documentFolders.findFirst({
    where: and(
      eq(schema.documentFolders.id, id),
      eq(schema.documentFolders.organisationId, user.organisationId),
    ),
    with: {
      children: true,
      documents: true,
    },
  })

  if (!folder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Folder not found',
    })
  }

  // Verify target folder if specified
  let targetPath = '/'
  if (targetFolderId) {
    if (targetFolderId === id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot move contents to the folder being deleted',
      })
    }

    const targetFolder = await db.query.documentFolders.findFirst({
      where: and(
        eq(schema.documentFolders.id, targetFolderId),
        eq(schema.documentFolders.organisationId, user.organisationId),
      ),
    })

    if (!targetFolder) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target folder not found',
      })
    }

    // Prevent moving to a descendant of the folder being deleted
    const folderPathPrefix = folder.path.endsWith('/')
      ? `${folder.path}${id}/`
      : `${folder.path}/${id}/`
    if (targetFolder.path.startsWith(folderPathPrefix) || targetFolder.path.includes(`/${id}/`)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot move contents to a descendant of the folder being deleted',
      })
    }

    targetPath = targetFolder.path.endsWith('/')
      ? `${targetFolder.path}${targetFolderId}/`
      : `${targetFolder.path}/${targetFolderId}/`
  }

  if (mode === 'cascade') {
    // Delete all documents in this folder and descendants
    const folderPathPrefix = folder.path.endsWith('/')
      ? `${folder.path}${id}/`
      : `${folder.path}/${id}/`

    // Get all descendant folders
    const descendantFolders = await db.query.documentFolders.findMany({
      where: and(
        eq(schema.documentFolders.organisationId, user.organisationId),
        like(schema.documentFolders.path, `${folderPathPrefix}%`),
      ),
    })

    const allFolderIds = [id, ...descendantFolders.map((f) => f.id)]

    // Note: Documents have onDelete: 'set null' for folderId, so they won't be deleted
    // Just update them to have no folder (orphaned documents)
    // If true cascade is needed, uncomment below:
    // for (const folderId of allFolderIds) {
    //   await db.delete(schema.documents).where(eq(schema.documents.folderId, folderId))
    // }

    // Delete all descendant folders (children will be deleted with the folder via cascade or manual)
    for (const descendant of descendantFolders.reverse()) {
      await db.delete(schema.documentFolders).where(eq(schema.documentFolders.id, descendant.id))
    }

    // Delete the folder itself
    await db.delete(schema.documentFolders).where(eq(schema.documentFolders.id, id))
  } else {
    // Mode: 'move' - Move children and documents to target folder or root

    // Move child folders to target (or root)
    for (const child of folder.children) {
      const newPath = targetFolderId ? targetPath : '/'

      await db
        .update(schema.documentFolders)
        .set({
          parentId: targetFolderId || null,
          path: newPath,
          updatedAt: new Date(),
        })
        .where(eq(schema.documentFolders.id, child.id))

      // Update descendants of this child folder
      const childOldPath = child.path.endsWith('/')
        ? `${child.path}${child.id}/`
        : `${child.path}/${child.id}/`
      const childNewPath = newPath.endsWith('/')
        ? `${newPath}${child.id}/`
        : `${newPath}/${child.id}/`

      const childDescendants = await db.query.documentFolders.findMany({
        where: and(
          eq(schema.documentFolders.organisationId, user.organisationId),
          like(schema.documentFolders.path, `${childOldPath}%`),
        ),
      })

      for (const descendant of childDescendants) {
        const updatedPath = descendant.path.replace(childOldPath, childNewPath)
        await db
          .update(schema.documentFolders)
          .set({ path: updatedPath, updatedAt: new Date() })
          .where(eq(schema.documentFolders.id, descendant.id))
      }
    }

    // Move documents to target folder or root (null)
    if (folder.documents.length > 0) {
      await db
        .update(schema.documents)
        .set({
          folderId: targetFolderId || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.documents.folderId, id))
    }

    // Delete the now-empty folder
    await db.delete(schema.documentFolders).where(eq(schema.documentFolders.id, id))
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entityType: 'document_folder',
    entityId: id,
    oldValues: {
      name: folder.name,
      path: folder.path,
      parentId: folder.parentId,
      mode,
      targetFolderId: targetFolderId || null,
      childCount: folder.children.length,
      documentCount: folder.documents.length,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
