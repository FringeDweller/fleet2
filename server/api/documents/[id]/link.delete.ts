import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const unlinkDocumentSchema = z.object({
  entityType: z.enum(['asset', 'work_order', 'part', 'inspection', 'operator', 'defect']),
  entityId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  const body = await readBody(event)
  const result = unlinkDocumentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { entityType, entityId } = result.data

  // Verify document exists and belongs to organisation
  const document = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, documentId),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
    columns: { id: true, name: true },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Find the link to delete
  const link = await db.query.documentLinks.findFirst({
    where: and(
      eq(schema.documentLinks.documentId, documentId),
      eq(schema.documentLinks.entityType, entityType),
      eq(schema.documentLinks.entityId, entityId),
    ),
    columns: { id: true },
  })

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document link not found',
    })
  }

  // Delete the link
  await db.delete(schema.documentLinks).where(eq(schema.documentLinks.id, link.id))

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document_link.deleted',
    entityType: 'document_link',
    entityId: link.id,
    oldValues: {
      documentId,
      documentName: document.name,
      linkedEntityType: entityType,
      linkedEntityId: entityId,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
