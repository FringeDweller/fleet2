import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const reorderSchema = z.object({
  groupId: z.string().uuid(),
  newSortOrder: z.number().int().min(0),
  parentId: z.string().uuid().optional().nullable(),
})

const reorderBatchSchema = z.array(reorderSchema)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = reorderBatchSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify all groups belong to this organisation
  const groupIds = result.data.map((item) => item.groupId)
  const groups = await db.query.taskGroups.findMany({
    where: (table) =>
      and(eq(table.organisationId, session.user!.organisationId), inArray(table.id, groupIds)),
  })

  if (groups.length !== groupIds.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'One or more groups not found',
    })
  }

  // Update each group's sort order in a transaction
  await db.transaction(async (tx) => {
    for (const item of result.data) {
      await tx
        .update(schema.taskGroups)
        .set({
          sortOrder: item.newSortOrder,
          parentId: item.parentId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.taskGroups.id, item.groupId),
            eq(schema.taskGroups.organisationId, session.user!.organisationId),
          ),
        )
    }
  })

  // Log the reorder action
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'task_group',
    entityId: 'batch_reorder',
    newValues: { reorderedGroups: result.data },
  })

  return { success: true, reordered: result.data.length }
})
