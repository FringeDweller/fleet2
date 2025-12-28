import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: { id: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  const documents = await db.query.assetDocuments.findMany({
    where: eq(schema.assetDocuments.assetId, assetId),
    with: {
      uploadedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (documents, { desc }) => [desc(documents.createdAt)],
  })

  return documents
})
