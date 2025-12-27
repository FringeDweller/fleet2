import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'

const addPartSchema = z.object({
  partId: z.string().uuid(),
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  const body = await readBody(event)
  const result = addPartSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset exists and belongs to org
  const asset = await db.query.assets.findFirst({
    where: and(eq(schema.assets.id, id), eq(schema.assets.organisationId, user.organisationId)),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Verify part exists and belongs to org
  const part = await db.query.parts.findFirst({
    where: and(
      eq(schema.parts.id, result.data.partId),
      eq(schema.parts.organisationId, user.organisationId),
    ),
  })

  if (!part) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Part not found',
    })
  }

  // Check if already exists
  const existing = await db.query.assetParts.findFirst({
    where: and(eq(schema.assetParts.assetId, id), eq(schema.assetParts.partId, result.data.partId)),
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Part is already assigned to this asset',
    })
  }

  // Insert
  const inserted = await db
    .insert(schema.assetParts)
    .values({
      assetId: id,
      partId: result.data.partId,
      notes: result.data.notes,
    })
    .returning()

  const record = inserted[0]!

  // Audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'asset_part',
    entityId: record.id,
    newValues: {
      assetId: id,
      partId: result.data.partId,
    },
  })

  return record
})
