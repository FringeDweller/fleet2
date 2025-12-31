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
  const linkId = getRouterParam(event, 'linkId')

  if (!assetId || !linkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID and Link ID are required',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, session.user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Get the link and verify it belongs to this asset
  const link = await db.query.documentLinks.findFirst({
    where: and(
      eq(schema.documentLinks.id, linkId),
      eq(schema.documentLinks.entityType, 'asset'),
      eq(schema.documentLinks.entityId, assetId),
    ),
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
      entityType: 'asset',
      entityId: assetId,
      assetNumber: asset.assetNumber,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
