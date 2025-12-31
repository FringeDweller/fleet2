import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * POST /api/custom-form-submissions
 * Submit a custom form response
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

  // Validate required fields
  if (!body.formId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Form ID is required',
    })
  }

  if (!body.responses || typeof body.responses !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Responses are required',
    })
  }

  const status = body.status === 'draft' ? 'draft' : 'submitted'

  // Get form and validate it exists for this organization
  const form = await db.query.customForms.findFirst({
    where: and(
      eq(schema.customForms.id, body.formId),
      eq(schema.customForms.organisationId, session.user.organisationId),
    ),
  })

  if (!form) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form not found',
    })
  }

  // Get the version to submit against
  let versionId = body.versionId

  // If no version specified, get the latest published version
  if (!versionId) {
    const latestVersion = await db.query.customFormVersions.findFirst({
      where: eq(schema.customFormVersions.formId, body.formId),
      orderBy: [desc(schema.customFormVersions.version)],
    })

    if (!latestVersion) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No published version found for this form',
      })
    }

    versionId = latestVersion.id
  }

  // Validate the version exists
  const version = await db.query.customFormVersions.findFirst({
    where: and(
      eq(schema.customFormVersions.id, versionId),
      eq(schema.customFormVersions.formId, body.formId),
    ),
  })

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form version not found',
    })
  }

  // Validate responses if submitting (not draft)
  if (status === 'submitted') {
    const validationErrors = validateResponses(version.fields, body.responses)
    if (validationErrors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation failed: ${validationErrors.join(', ')}`,
      })
    }
  }

  // Create submission
  const result = await db
    .insert(schema.customFormSubmissions)
    .values({
      organisationId: session.user.organisationId,
      formId: body.formId,
      versionId,
      responses: body.responses,
      status,
      submitterNotes: body.notes || null,
      contextType: body.contextType || null,
      contextId: body.contextId || null,
      submittedAt: new Date(),
      submittedById: session.user.id,
    })
    .returning()

  const submission = result[0]
  if (!submission) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create submission',
    })
  }

  return {
    id: submission.id,
    status: submission.status,
    submittedAt: submission.submittedAt,
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
    // Skip section fields
    if (field.fieldType === 'section') continue

    // Skip calculated fields
    if (field.fieldType === 'calculated') continue

    const value = responses[field.id]

    // Check required fields
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

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') continue

    // Validate based on field type
    switch (field.fieldType) {
      case 'email':
        if (typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            errors.push(`${field.label} must be a valid email`)
          }
        }
        break

      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value)
          } catch {
            errors.push(`${field.label} must be a valid URL`)
          }
        }
        break

      case 'number':
        if (typeof value !== 'number' && Number.isNaN(Number.parseFloat(String(value)))) {
          errors.push(`${field.label} must be a number`)
        }
        if (field.validation) {
          const num = Number.parseFloat(String(value))
          if (field.validation.min !== undefined && num < field.validation.min) {
            errors.push(`${field.label} must be at least ${field.validation.min}`)
          }
          if (field.validation.max !== undefined && num > field.validation.max) {
            errors.push(`${field.label} must be at most ${field.validation.max}`)
          }
        }
        break

      case 'text':
      case 'textarea':
        if (typeof value === 'string' && field.validation) {
          if (field.validation.minLength && value.length < field.validation.minLength) {
            errors.push(`${field.label} must be at least ${field.validation.minLength} characters`)
          }
          if (field.validation.maxLength && value.length > field.validation.maxLength) {
            errors.push(`${field.label} must be at most ${field.validation.maxLength} characters`)
          }
        }
        break
    }
  }

  return errors
}
