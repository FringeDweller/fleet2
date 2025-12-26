import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { eq, and } from 'drizzle-orm'

const maintenanceScheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  intervalDays: z.number().int().positive().optional(),
  intervalHours: z.number().positive().optional(),
  intervalMileage: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  checklistItems: z.array(z.string()).optional()
})

const defaultPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional()
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  defaultMaintenanceSchedules: z.array(maintenanceScheduleSchema).optional(),
  defaultParts: z.array(defaultPartSchema).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing category ID'
    })
  }

  const body = await readBody(event)
  const result = updateCategorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  // Verify category exists and belongs to org
  const existing = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, id),
      eq(schema.assetCategories.organisationId, session.user.organisationId)
    )
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found'
    })
  }

  // Prevent circular parent reference
  if (result.data.parentId) {
    if (result.data.parentId === id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category cannot be its own parent'
      })
    }

    // Check if new parent is a descendant of this category
    const isDescendant = await checkIsDescendant(id, result.data.parentId, session.user.organisationId)
    if (isDescendant) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot set a descendant category as parent (circular reference)'
      })
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (result.data.name !== undefined) updateData.name = result.data.name
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.parentId !== undefined) updateData.parentId = result.data.parentId
  if (result.data.defaultMaintenanceSchedules !== undefined) updateData.defaultMaintenanceSchedules = result.data.defaultMaintenanceSchedules
  if (result.data.defaultParts !== undefined) updateData.defaultParts = result.data.defaultParts
  if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive

  const [updated] = await db
    .update(schema.assetCategories)
    .set(updateData)
    .where(eq(schema.assetCategories.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'asset_category',
    entityId: id,
    oldValues: { name: existing.name, parentId: existing.parentId },
    newValues: updateData
  })

  return updated
})

async function checkIsDescendant(
  categoryId: string,
  potentialParentId: string,
  organisationId: string
): Promise<boolean> {
  // Get all descendants of the category
  const descendants = new Set<string>()
  const queue = [categoryId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = await db.query.assetCategories.findMany({
      where: and(
        eq(schema.assetCategories.parentId, currentId),
        eq(schema.assetCategories.organisationId, organisationId)
      ),
      columns: { id: true }
    })

    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id)
        queue.push(child.id)
      }
    }
  }

  return descendants.has(potentialParentId)
}
