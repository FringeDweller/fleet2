import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const updateCheckpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  position: z.string().min(1).max(50).optional(),
  qrCode: z.string().max(255).optional().nullable(),
  nfcTag: z.string().max(255).optional().nullable(),
  required: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

/**
 * PUT /api/inspection-checkpoints/definitions/:id
 *
 * Update a checkpoint definition.
 */
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
      statusMessage: 'Checkpoint definition ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateCheckpointSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get existing definition
  const existing = await db.query.inspectionCheckpointDefinitions.findFirst({
    where: and(
      eq(schema.inspectionCheckpointDefinitions.id, id),
      eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
    ),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Checkpoint definition not found',
    })
  }

  // Check for duplicate QR code if being updated
  if (result.data.qrCode !== undefined && result.data.qrCode) {
    const existingQr = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.qrCode, result.data.qrCode),
        ne(schema.inspectionCheckpointDefinitions.id, id),
      ),
    })

    if (existingQr) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A checkpoint with this QR code already exists',
      })
    }
  }

  // Check for duplicate NFC tag if being updated
  if (result.data.nfcTag !== undefined && result.data.nfcTag) {
    const existingNfc = await db.query.inspectionCheckpointDefinitions.findFirst({
      where: and(
        eq(schema.inspectionCheckpointDefinitions.organisationId, session.user.organisationId),
        eq(schema.inspectionCheckpointDefinitions.nfcTag, result.data.nfcTag),
        ne(schema.inspectionCheckpointDefinitions.id, id),
      ),
    })

    if (existingNfc) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A checkpoint with this NFC tag already exists',
      })
    }
  }

  const [updated] = await db
    .update(schema.inspectionCheckpointDefinitions)
    .set({
      ...result.data,
      updatedAt: new Date(),
    })
    .where(eq(schema.inspectionCheckpointDefinitions.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'update',
    entityType: 'inspection_checkpoint_definition',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  })

  return updated
})
