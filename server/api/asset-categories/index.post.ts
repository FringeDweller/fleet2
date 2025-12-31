import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { invalidateResource } from '../../utils/cache'
import { db, schema } from '../../utils/db'

const maintenanceScheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  intervalDays: z.number().int().positive().optional(),
  intervalHours: z.number().positive().optional(),
  intervalMileage: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  checklistItems: z.array(z.string()).optional(),
})

const defaultPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  defaultMaintenanceSchedules: z.array(maintenanceScheduleSchema).optional().default([]),
  defaultParts: z.array(defaultPartSchema).optional().default([]),
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
  const result = createCategorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify parent exists and belongs to org if provided
  if (result.data.parentId) {
    const parent = await db.query.assetCategories.findFirst({
      where: and(
        eq(schema.assetCategories.id, result.data.parentId),
        eq(schema.assetCategories.organisationId, session.user.organisationId),
      ),
    })

    if (!parent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Parent category not found',
      })
    }
  }

  const [category] = await db
    .insert(schema.assetCategories)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId,
      defaultMaintenanceSchedules: result.data.defaultMaintenanceSchedules,
      defaultParts: result.data.defaultParts,
    })
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'asset_category',
    entityId: category!.id,
    newValues: { name: result.data.name, parentId: result.data.parentId },
  })

  // US-18.1.1: Invalidate cache after modification
  await invalidateResource('asset-categories', session.user.organisationId)

  return category
})
