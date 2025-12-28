import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateDefectSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  location: z.string().max(255).optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  // Allow linking to a work order
  workOrderId: z.string().uuid().optional().nullable(),
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
      statusMessage: 'Defect ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateDefectSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Find existing defect
  const existingDefect = await db.query.defects.findFirst({
    where: and(eq(schema.defects.id, id), eq(schema.defects.organisationId, user.organisationId)),
  })

  if (!existingDefect) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Defect not found',
    })
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    ...result.data,
    updatedAt: new Date(),
  }

  // If status is being resolved or closed, set resolved fields
  if (result.data.status === 'resolved' || result.data.status === 'closed') {
    if (!existingDefect.resolvedAt) {
      updateValues.resolvedById = user.id
      updateValues.resolvedAt = new Date()
    }
  }

  // Update the defect
  const [updatedDefect] = await db
    .update(schema.defects)
    .set(updateValues)
    .where(eq(schema.defects.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'defect',
    entityId: id,
    oldValues: existingDefect,
    newValues: updatedDefect,
  })

  return updatedDefect
})
