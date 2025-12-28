import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const createCheckpointSchema = z.object({
  assetCategoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  position: z.string().min(1).max(50),
  qrCode: z.string().max(255).optional(),
  nfcTag: z.string().max(255).optional(),
  required: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

/**
 * POST /api/inspection-checkpoints/definitions
 *
 * Create a new checkpoint definition for an asset category.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const result = createCheckpointSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify the asset category belongs to this organisation
  const category = await db.query.assetCategories.findFirst({
    where: and(
      eq(schema.assetCategories.id, result.data.assetCategoryId),
      eq(schema.assetCategories.organisationId, session.user.organisationId),
    ),
  })

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset category not found',
    })
  }

  // Check for duplicate QR code within organisation if provided
  if (result.data.qrCode) {
    const existingQr = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.qrCode, result.data.qrCode),
      ),
    })

    if (existingQr) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A checkpoint with this QR code already exists',
      })
    }
  }

  // Check for duplicate NFC tag within organisation if provided
  if (result.data.nfcTag) {
    const existingNfc = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.nfcTag, result.data.nfcTag),
      ),
    })

    if (existingNfc) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A checkpoint with this NFC tag already exists',
      })
    }
  }

  const [definition] = await db
    .insert(schema.inspectionCheckpointDefinitions)
    .values({
      organisationId: session.user.organisationId,
      assetCategoryId: result.data.assetCategoryId,
      name: result.data.name,
      description: result.data.description || null,
      position: result.data.position,
      qrCode: result.data.qrCode || null,
      nfcTag: result.data.nfcTag || null,
      required: result.data.required,
      displayOrder: result.data.displayOrder,
      isActive: result.data.isActive,
    })
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'create',
    entityType: 'inspection_checkpoint_definition',
    entityId: definition!.id,
    newValues: definition,
  })

  return definition
})
