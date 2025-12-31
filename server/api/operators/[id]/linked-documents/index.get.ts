import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'
import { getPreviewType, getPreviewUrl } from '../../../../utils/document-preview'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const operatorId = getRouterParam(event, 'id')

  if (!operatorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Operator ID is required',
    })
  }

  // Verify operator exists and belongs to organisation
  const operator = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, operatorId),
      eq(schema.users.organisationId, user.organisationId),
    ),
    columns: { id: true },
  })

  if (!operator) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Operator not found',
    })
  }

  // Get all document links for this operator
  const links = await db.query.documentLinks.findMany({
    where: and(
      eq(schema.documentLinks.entityType, 'operator'),
      eq(schema.documentLinks.entityId, operatorId),
    ),
    with: {
      document: {
        columns: {
          id: true,
          name: true,
          originalFilename: true,
          filePath: true,
          mimeType: true,
          fileSize: true,
          description: true,
          category: true,
          tags: true,
          expiryDate: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          uploadedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      linkedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: (links, { desc }) => [desc(links.createdAt)],
  })

  // Filter to only include documents from the same organisation and add preview info
  const documentsWithPreview = await Promise.all(
    links
      .filter((link) => link.document)
      .map(async (link) => {
        // Verify document belongs to organisation
        const doc = await db.query.documents.findFirst({
          where: and(
            eq(schema.documents.id, link.document.id),
            eq(schema.documents.organisationId, user.organisationId),
          ),
          columns: { id: true },
        })

        if (!doc) {
          return null
        }

        return {
          linkId: link.id,
          linkedAt: link.createdAt,
          linkedBy: link.linkedBy,
          document: {
            ...link.document,
            previewUrl: getPreviewUrl(link.document.mimeType, link.document.filePath),
            previewType: getPreviewType(link.document.mimeType),
          },
        }
      }),
  )

  return documentsWithPreview.filter(Boolean)
})
