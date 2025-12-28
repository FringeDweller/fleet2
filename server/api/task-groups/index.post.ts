import { z } from 'zod'
import { db, schema } from '../../utils/db'

const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = createGroupSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // If parentId is provided, verify it exists and belongs to this organisation
  if (result.data.parentId) {
    const parent = await db.query.taskGroups.findFirst({
      where: (groups, { and, eq }) =>
        and(
          eq(groups.id, result.data.parentId!),
          eq(groups.organisationId, session.user!.organisationId),
        ),
    })

    if (!parent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Parent group not found',
      })
    }
  }

  const [group] = await db
    .insert(schema.taskGroups)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId,
      sortOrder: result.data.sortOrder,
    })
    .returning()

  if (!group) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create task group',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'task_group',
    entityId: group.id,
    newValues: group,
  })

  return group
})
