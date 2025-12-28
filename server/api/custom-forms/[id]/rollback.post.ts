import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const rollbackSchema = z.object({
  targetVersion: z.number().int().min(1),
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

  const body = await readBody(event)
  const result = rollbackSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
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

  // Get the target version to rollback to
  const targetVersion = await db.query.customFormVersions.findFirst({
    where: and(
      eq(schema.customFormVersions.formId, id),
      eq(schema.customFormVersions.version, result.data.targetVersion),
    ),
  })

  if (!targetVersion) {
    throw createError({
      statusCode: 404,
      statusMessage: `Version ${result.data.targetVersion} not found`,
    })
  }

  // Get the current highest version number
  const latestVersion = await db.query.customFormVersions.findFirst({
    where: eq(schema.customFormVersions.formId, id),
    orderBy: [desc(schema.customFormVersions.version)],
  })

  const newVersionNumber = (latestVersion?.version || 0) + 1

  // Create a new version that represents the rollback
  const [newVersion] = await db
    .insert(schema.customFormVersions)
    .values({
      organisationId: user.organisationId,
      formId: id,
      version: newVersionNumber,
      name: targetVersion.name,
      description: targetVersion.description,
      fields: targetVersion.fields,
      settings: targetVersion.settings || {},
      changelog: result.data.changelog || `Rolled back to version ${result.data.targetVersion}`,
      publishedById: user.id,
    })
    .returning()

  // Update the form with the rollback content
  const [updatedForm] = await db
    .update(schema.customForms)
    .set({
      name: targetVersion.name,
      description: targetVersion.description,
      fields: targetVersion.fields,
      settings: targetVersion.settings,
      version: newVersionNumber,
      updatedAt: new Date(),
      updatedById: user.id,
    })
    .where(eq(schema.customForms.id, id))
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'rollback',
    entityType: 'custom_form',
    entityId: id,
    oldValues: {
      version: existingForm.version,
      name: existingForm.name,
    },
    newValues: {
      version: newVersionNumber,
      versionId: newVersion!.id,
      rolledBackTo: result.data.targetVersion,
    },
  })

  return {
    form: updatedForm,
    version: newVersion,
    rolledBackFrom: existingForm.version,
    rolledBackTo: result.data.targetVersion,
  }
})
