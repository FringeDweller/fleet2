import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { getPreviewType, getPreviewUrl } from '../../../../utils/document-preview'

const linkDocumentSchema = z.object({
  documentId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const workOrderId = getRouterParam(event, 'id')

  if (!workOrderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID is required',
    })
  }

  const body = await readBody(event)
  const result = linkDocumentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { documentId } = result.data

  // Verify work order exists and belongs to organisation
  const workOrder = await db.query.workOrders.findFirst({
    where: and(
      eq(schema.workOrders.id, workOrderId),
      eq(schema.workOrders.organisationId, session.user.organisationId),
    ),
    columns: { id: true, workOrderNumber: true },
  })

  if (!workOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work order not found',
    })
  }

  // Verify document exists and belongs to organisation
  const document = await db.query.documents.findFirst({
    where: and(
      eq(schema.documents.id, documentId),
      eq(schema.documents.organisationId, session.user.organisationId),
    ),
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
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    })
  }

  // Check if link already exists
  const existingLink = await db.query.documentLinks.findFirst({
    where: and(
      eq(schema.documentLinks.documentId, documentId),
      eq(schema.documentLinks.entityType, 'work_order'),
      eq(schema.documentLinks.entityId, workOrderId),
    ),
    columns: { id: true },
  })

  if (existingLink) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Document is already linked to this work order',
    })
  }

  // Create the link
  const [link] = await db
    .insert(schema.documentLinks)
    .values({
      documentId,
      entityType: 'work_order',
      entityId: workOrderId,
      linkedById: session.user.id,
    })
    .returning()

  if (!link) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to link document',
    })
  }

  // Create audit log
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'document_link.created',
    entityType: 'document_link',
    entityId: link.id,
    newValues: {
      documentId,
      documentName: document.name,
      entityType: 'work_order',
      entityId: workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  // Get linked by user info
  const linkedBy = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
    },
  })

  return {
    linkId: link.id,
    linkedAt: link.createdAt,
    linkedBy,
    document: {
      ...document,
      previewUrl: getPreviewUrl(document.mimeType, document.filePath),
      previewType: getPreviewType(document.mimeType),
    },
  }
})
