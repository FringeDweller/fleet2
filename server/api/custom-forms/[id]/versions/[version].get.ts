import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')
  const versionParam = getRouterParam(event, 'version')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Form ID is required',
    })
  }

  if (!versionParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Version number is required',
    })
  }

  const versionNumber = parseInt(versionParam, 10)
  if (Number.isNaN(versionNumber) || versionNumber < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid version number',
    })
  }

  // Verify the form exists and belongs to the user's organization
  const form = await db.query.customForms.findFirst({
    where: and(
      eq(schema.customForms.id, id),
      eq(schema.customForms.organisationId, session.user.organisationId),
    ),
  })

  if (!form) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form not found',
    })
  }

  // Get the specific version
  const version = await db.query.customFormVersions.findFirst({
    where: and(
      eq(schema.customFormVersions.formId, id),
      eq(schema.customFormVersions.version, versionNumber),
    ),
    with: {
      publishedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!version) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Version not found',
    })
  }

  // Get submission count for this version
  const submissionCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormSubmissions)
    .where(eq(schema.customFormSubmissions.versionId, version.id))

  return {
    ...version,
    fieldCount: version.fields?.length || 0,
    submissionCount: submissionCount[0]?.count || 0,
  }
})
