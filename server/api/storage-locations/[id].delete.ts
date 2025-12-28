import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

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

  // Check if location has children
  const children = await db.query.storageLocations.findMany({
    where: and(
      eq(schema.storageLocations.parentId, id),
      eq(schema.storageLocations.organisationId, session.user.organisationId),
    ),
  })

  if (children.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Cannot delete location with child locations. Please delete or reassign children first.',
    })
  }

  // Check if location has inventory
  const inventory = await db.query.partLocationQuantities.findFirst({
    where: and(
      eq(schema.partLocationQuantities.locationId, id),
      eq(schema.partLocationQuantities.organisationId, session.user.organisationId),
    ),
  })

  if (inventory) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete location with inventory. Please transfer parts first.',
    })
  }

  await db.delete(schema.storageLocations).where(eq(schema.storageLocations.id, id))

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'storage_location',
    entityId: id,
    oldValues: { name: location.name },
  })

  return { success: true }
})
