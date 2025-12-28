import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['warehouse', 'bin', 'shelf', 'truck', 'building', 'room', 'other']).optional(),
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
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
      statusMessage: 'Location ID is required',
    })
  }

  // Check if location exists
  const location = await db.query.storageLocations.findFirst({
    where: and(
      eq(schema.storageLocations.id, id),
      eq(schema.storageLocations.organisationId, session.user.organisationId),
    ),
  })

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Location not found',
    })
  }

  const body = await readBody(event)
  const result = updateLocationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify parent exists if provided
  if (result.data.parentId) {
    // Prevent setting self as parent
    if (result.data.parentId === id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A location cannot be its own parent',
      })
    }

    const parent = await db.query.storageLocations.findFirst({
      where: and(
        eq(schema.storageLocations.id, result.data.parentId),
        eq(schema.storageLocations.organisationId, session.user.organisationId),
      ),
    })

    if (!parent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Parent location not found',
      })
    }
  }

  // Check for duplicate code if changed
  if (result.data.code && result.data.code !== location.code) {
    const existingCode = await db.query.storageLocations.findFirst({
      where: and(
        eq(schema.storageLocations.organisationId, session.user.organisationId),
        eq(schema.storageLocations.code, result.data.code),
      ),
    })

    if (existingCode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A location with this code already exists',
      })
    }
  }

  const updateData = {
    ...result.data,
    updatedAt: new Date(),
  }

  const [updated] = await db
    .update(schema.storageLocations)
    .set(updateData)
    .where(eq(schema.storageLocations.id, id))
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'storage_location',
    entityId: id,
    oldValues: { name: location.name },
    newValues: { name: result.data.name || location.name },
  })

  return updated
})
