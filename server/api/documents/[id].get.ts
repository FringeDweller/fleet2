import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * GET /api/documents/[id] - Get a specific document with full details
 * Returns document metadata, folder info, and version history
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
      statusMessage: 'Document ID is required',
    })
  }

  const document = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, id),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
    with: {
      folder: {
        columns: {
          id: true,
          name: true,
          path: true,
        },
      },
      uploadedBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      versions: {
        orderBy: (versions, { desc }) => [desc(versions.versionNumber)],
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
      links: {
        with: {
          linkedBy: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Calculate expiry status
  let expiryStatus: 'expired' | 'expiring_soon' | 'valid' | null = null
  let daysUntilExpiry: number | null = null

  if (document.expiryDate) {
    const now = new Date()
    daysUntilExpiry = Math.ceil(
      (document.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysUntilExpiry < 0) {
      expiryStatus = 'expired'
    } else if (daysUntilExpiry <= 30) {
      expiryStatus = 'expiring_soon'
    } else {
      expiryStatus = 'valid'
    }
  }

  return {
    ...document,
    expiryStatus,
    daysUntilExpiry,
  }
})
