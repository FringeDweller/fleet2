import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const publishFormSchema = z.object({
  changelog: z.string().max(1000).optional(),
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

  // Validate form has fields before publishing
  if (!existingForm.fields || existingForm.fields.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot publish a form with no fields',
    })
  }

  const body = await readBody(event)
  const result = publishFormSchema.safeParse(body || {})

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get the current highest version number for this form
  const latestVersion = await db.query.customFormVersions.findFirst({
    where: eq(schema.customFormVersions.formId, id),
    orderBy: [desc(schema.customFormVersions.version)],
  })

  const newVersionNumber = (latestVersion?.version || 0) + 1

  // Create the new version snapshot
  const [newVersion] = await db
    .insert(schema.customFormVersions)
    .values({
      organisationId: user.organisationId,
      formId: id,
      version: newVersionNumber,
      name: existingForm.name,
      description: existingForm.description,
      fields: existingForm.fields,
      settings: existingForm.settings || {},
      changelog: result.data.changelog,
      publishedById: user.id,
    })
    .returning()

  // Update the form's version number and set status to active if in draft
  const updateData: Record<string, unknown> = {
    version: newVersionNumber,
    updatedAt: new Date(),
    updatedById: user.id,
  }

  // Automatically activate the form when publishing
  if (existingForm.status === 'draft') {
    updateData.status = 'active'
  }

  const [updatedForm] = await db
    .update(schema.customForms)
    .set(updateData)
    .where(eq(schema.customForms.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'publish',
    entityType: 'custom_form',
    entityId: id,
    oldValues: { version: existingForm.version },
    newValues: { version: newVersionNumber, versionId: newVersion!.id },
  })

  return {
    form: updatedForm,
    version: newVersion,
  }
})
