import { and, desc, eq, sql } from 'drizzle-orm'
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

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Form ID is required',
    })
  }

  const query = getQuery(event)

  // Pagination
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0)

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

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.customFormVersions)
    .where(eq(schema.customFormVersions.formId, id))

  const total = countResult[0]?.count || 0

  // Get versions with publisher info
  const versions = await db.query.customFormVersions.findMany({
    where: eq(schema.customFormVersions.formId, id),
    with: {
      publishedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [desc(schema.customFormVersions.version)],
    limit,
    offset,
  })

  // Add field count to each version
  const versionsWithMeta = versions.map((version) => ({
    ...version,
    fieldCount: version.fields?.length || 0,
  }))

  return {
    data: versionsWithMeta,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + versions.length < total,
    },
  }
})
