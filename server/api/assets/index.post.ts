import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

const createAssetSchema = z.object({
  assetNumber: z.string().min(1, 'Asset number is required').max(50).optional(),
  vin: z.string().max(17).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  operationalHours: z.number().min(0).optional().default(0),
  mileage: z.number().min(0).optional().default(0),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional().default('active'),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
})

async function generateAssetNumber(organisationId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assets)
    .where(eq(schema.assets.organisationId, organisationId))

  const count = result[0]?.count ?? 0
  const nextNumber = count + 1
  return `FLT-${nextNumber.toString().padStart(4, '0')}`
}

export default defineEventHandler(async (event) => {
  // Require assets:write permission to create assets
  const user = await requirePermission(event, 'assets:write')

  const body = await readBody(event)
  const result = createAssetSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const assetNumber = result.data.assetNumber || (await generateAssetNumber(user.organisationId))

  const [asset] = await db
    .insert(schema.assets)
    .values({
      organisationId: user.organisationId,
      assetNumber,
      vin: result.data.vin,
      make: result.data.make,
      model: result.data.model,
      year: result.data.year,
      licensePlate: result.data.licensePlate,
      operationalHours: result.data.operationalHours?.toString(),
      mileage: result.data.mileage?.toString(),
      status: result.data.status,
      description: result.data.description,
      imageUrl: result.data.imageUrl,
      categoryId: result.data.categoryId,
    })
    .returning()

  if (!asset) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create asset',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'asset',
    entityId: asset.id,
    newValues: asset,
  })

  return asset
})
