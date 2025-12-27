import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateAssetSchema = z.object({
  assetNumber: z.string().min(1).max(50).optional(),
  vin: z.string().max(17).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  operationalHours: z.number().min(0).optional(),
  mileage: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
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
      statusMessage: 'Asset ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateAssetSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get existing asset for audit log
  const existingAsset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, id),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
  })

  if (!existingAsset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.assetNumber !== undefined) updateData.assetNumber = result.data.assetNumber
  if (result.data.vin !== undefined) updateData.vin = result.data.vin
  if (result.data.make !== undefined) updateData.make = result.data.make
  if (result.data.model !== undefined) updateData.model = result.data.model
  if (result.data.year !== undefined) updateData.year = result.data.year
  if (result.data.licensePlate !== undefined) updateData.licensePlate = result.data.licensePlate
  if (result.data.operationalHours !== undefined)
    updateData.operationalHours = result.data.operationalHours.toString()
  if (result.data.mileage !== undefined) updateData.mileage = result.data.mileage.toString()
  if (result.data.status !== undefined) updateData.status = result.data.status
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.imageUrl !== undefined) updateData.imageUrl = result.data.imageUrl
  if (result.data.categoryId !== undefined) updateData.categoryId = result.data.categoryId

  const [updatedAsset] = await db
    .update(schema.assets)
    .set(updateData)
    .where(
      and(eq(schema.assets.id, id), eq(schema.assets.organisationId, session.user.organisationId)),
    )
    .returning()

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'asset',
    entityId: id,
    oldValues: existingAsset,
    newValues: updatedAsset,
  })

  return updatedAsset
})
