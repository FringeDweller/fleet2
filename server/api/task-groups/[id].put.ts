import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

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
      statusMessage: 'Group ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateGroupSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Fetch existing group
  const existingGroup = await db.query.taskGroups.findFirst({
    where: and(
      eq(schema.taskGroups.id, id),
      eq(schema.taskGroups.organisationId, session.user.organisationId),
    ),
  })

  if (!existingGroup) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task group not found',
    })
  }

  // If parentId is being changed, verify it exists and doesn't create a cycle
  if (result.data.parentId !== undefined && result.data.parentId !== existingGroup.parentId) {
    if (result.data.parentId) {
      // Verify parent exists
      const parent = await db.query.taskGroups.findFirst({
        where: and(
          eq(schema.taskGroups.id, result.data.parentId),
          eq(schema.taskGroups.organisationId, session.user.organisationId),
        ),
      })

      if (!parent) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Parent group not found',
        })
      }

      // Check for cycles: parent cannot be a descendant of this group
      if (result.data.parentId === id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'A group cannot be its own parent',
        })
      }

      // Simple cycle detection (could be enhanced for deeper nesting)
      let currentParent = parent
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Circular parent relationship detected',
          })
        }
        const nextParent = await db.query.taskGroups.findFirst({
          where: eq(schema.taskGroups.id, currentParent.parentId),
        })
        if (!nextParent) break
        currentParent = nextParent
      }
    }
  }

  const [updatedGroup] = await db
    .update(schema.taskGroups)
    .set({
      ...result.data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.taskGroups.id, id),
        eq(schema.taskGroups.organisationId, session.user.organisationId),
      ),
    )
    .returning()

  if (!updatedGroup) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update task group',
    })
  }

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'task_group',
    entityId: updatedGroup.id,
    oldValues: existingGroup,
    newValues: updatedGroup,
  })

  return updatedGroup
})
