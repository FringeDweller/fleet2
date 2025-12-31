import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * PUT /api/custom-form-submissions/:id
 * Update a form submission (only drafts can be updated)
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
      statusMessage: 'Submission ID is required',
    })
  }

  const body = await readBody(event)

  // Get the existing submission
  const existing = await db.query.customFormSubmissions.findFirst({
    where: and(
      eq(schema.customFormSubmissions.id, id),
      eq(schema.customFormSubmissions.organisationId, session.user.organisationId),
    ),
    with: {
      version: {
        columns: {
          fields: true,
        },
      },
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Submission not found',
    })
  }

  // Only drafts can be updated
  if (existing.status !== 'draft') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only draft submissions can be updated',
    })
  }

  const newStatus = body.status === 'submitted' ? 'submitted' : 'draft'

  // Validate responses if submitting
  if (newStatus === 'submitted' && existing.version?.fields) {
    const validationErrors = validateResponses(existing.version.fields, body.responses)
    if (validationErrors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation failed: ${validationErrors.join(', ')}`,
      })
    }
  }

  // Update submission
  const result = await db
    .update(schema.customFormSubmissions)
    .set({
      responses: body.responses,
      status: newStatus,
      submitterNotes: body.notes !== undefined ? body.notes : existing.submitterNotes,
      submittedAt: newStatus === 'submitted' ? new Date() : existing.submittedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.customFormSubmissions.id, id))
    .returning()

  const updated = result[0]
  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update submission',
    })
  }

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt,
  }
})

// Validate responses against form fields
function validateResponses(
  fields: typeof schema.customForms.$inferSelect.fields,
  responses: Record<string, unknown>,
): string[] {
  const errors: string[] = []

  if (!fields) return errors

  for (const field of fields) {
    if (field.fieldType === 'section' || field.fieldType === 'calculated') continue

    const value = responses[field.id]

    if (field.required) {
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        errors.push(`${field.label} is required`)
      }
    }
  }

  return errors
}
