import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const linkId = getRouterParam(event, 'id')

  if (!linkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Link ID is required',
    })
  }

  // Get the link with document to verify organisation access
  const link = await db.query.documentLinks.findFirst({
    where: eq(schema.documentLinks.id, linkId),
    with: {
      document: {
        columns: {
          id: true,
          name: true,
          organisationId: true,
        },
      },
    },
  })

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document link not found',
    })
  }

  // Verify document belongs to user's organisation
  if (link.document?.organisationId !== session.user.organisationId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  // Delete the link
  await db.delete(schema.documentLinks).where(eq(schema.documentLinks.id, linkId))

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document_link.deleted',
    entityType: 'document_link',
    entityId: linkId,
    oldValues: {
      documentId: link.documentId,
      documentName: link.document?.name,
      entityType: link.entityType,
      entityId: link.entityId,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
