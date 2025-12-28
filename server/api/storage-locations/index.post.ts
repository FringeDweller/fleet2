import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const createLocationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  type: z
    .enum(['warehouse', 'bin', 'shelf', 'truck', 'building', 'room', 'other'])
    .default('warehouse'),
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().max(50).optional(),
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
  const result = createLocationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify parent exists if provided
  if (result.data.parentId) {
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

  // Check for duplicate code if provided
  if (result.data.code) {
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

  const [location] = await db
    .insert(schema.storageLocations)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      type: result.data.type,
      parentId: result.data.parentId,
      code: result.data.code,
    })
    .returning()

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'storage_location',
    entityId: location!.id,
    newValues: { name: result.data.name, type: result.data.type },
  })

  return location
})
