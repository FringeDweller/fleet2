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

  const user = session.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Form ID is required',
    })
  }

  // Get existing form
  const existingForm = await db.query.customForms.findFirst({
    where: and(
      eq(schema.customForms.id, id),
      eq(schema.customForms.organisationId, user.organisationId),
    ),
  })

  if (!existingForm) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form not found',
    })
  }

  // Archive instead of hard delete
  const [archivedForm] = await db
    .update(schema.customForms)
    .set({
      status: 'archived',
      updatedAt: new Date(),
      updatedById: user.id,
    })
    .where(eq(schema.customForms.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'archive',
    entityType: 'custom_form',
    entityId: id,
    oldValues: existingForm,
    newValues: archivedForm,
  })

  return { success: true, message: 'Form archived successfully' }
})
