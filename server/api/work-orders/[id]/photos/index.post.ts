import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const createPhotoSchema = z.object({
  photoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  photoType: z.enum(['before', 'during', 'after', 'issue', 'other']).default('other'),
  caption: z.string().max(500).optional().nullable(),
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
      statusMessage: 'Work order ID is required',
    })
  }

  const body = await readBody(event)
  const result = createPhotoSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, id),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  const [photo] = await db
    .insert(schema.workOrderPhotos)
    .values({
      workOrderId: id,
      photoUrl: result.data.photoUrl,
      thumbnailUrl: result.data.thumbnailUrl,
      photoType: result.data.photoType,
      caption: result.data.caption,
      uploadedById: session.user.id,
    })
    .returning()

  if (!photo) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add photo',
    })
  }

  return photo
})
