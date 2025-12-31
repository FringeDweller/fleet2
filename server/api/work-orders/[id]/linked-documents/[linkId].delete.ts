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

  const workOrderId = getRouterParam(event, 'id')
  const linkId = getRouterParam(event, 'linkId')

  if (!workOrderId || !linkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Work order ID and Link ID are required',
    })
  }

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

  // Get the link and verify it belongs to this work order
  const link = await db.query.documentLinks.findFirst({
    where: and(
      eq(schema.documentLinks.id, linkId),
      eq(schema.documentLinks.entityType, 'work_order'),
      eq(schema.documentLinks.entityId, workOrderId),
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
      entityType: 'work_order',
      entityId: workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return { success: true }
})
