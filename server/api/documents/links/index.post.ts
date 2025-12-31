import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const createLinkSchema = z.object({
  documentId: z.string().uuid(),
  entityType: z.enum(['asset', 'work_order', 'part', 'inspection', 'operator']),
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

  const body = await readBody(event)
  const result = createLinkSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { documentId, entityType, entityId } = result.data

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

  // Verify entity exists and belongs to organisation
  const entityExists = await verifyEntityExists(entityType, entityId, session.user.organisationId)

  if (!entityExists) {
    throw createError({
      statusCode: 404,
      statusMessage: `${entityType.charAt(0).toUpperCase() + entityType.slice(1).replace('_', ' ')} not found`,
    })
  }

  // Check if link already exists
  const existingLink = await db.query.documentLinks.findFirst({
    where: and(
      eq(schema.documentLinks.documentId, documentId),
      eq(schema.documentLinks.entityType, entityType),
      eq(schema.documentLinks.entityId, entityId),
    ),
    columns: { id: true },
  })

  if (existingLink) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Document is already linked to this entity',
    })
  }

  // Create the link
  const [link] = await db
    .insert(schema.documentLinks)
    .values({
      documentId,
      entityType,
      entityId,
      linkedById: session.user.id,
    })
    .returning()

  if (!link) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create document link',
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
      entityType,
      entityId,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return link
})

// Helper function to verify entity exists in the organisation
async function verifyEntityExists(
  entityType: 'asset' | 'work_order' | 'part' | 'inspection' | 'operator',
  entityId: string,
  organisationId: string,
): Promise<boolean> {
  switch (entityType) {
    case 'asset': {
      const asset = await db.query.assets.findFirst({
        where: and(
          eq(schema.assets.id, entityId),
          eq(schema.assets.organisationId, organisationId),
        ),
        columns: { id: true },
      })
      return !!asset
    }
    case 'work_order': {
      const workOrder = await db.query.workOrders.findFirst({
        where: and(
          eq(schema.workOrders.id, entityId),
          eq(schema.workOrders.organisationId, organisationId),
        ),
        columns: { id: true },
      })
      return !!workOrder
    }
    case 'part': {
      const part = await db.query.parts.findFirst({
        where: and(eq(schema.parts.id, entityId), eq(schema.parts.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!part
    }
    case 'inspection': {
      const inspection = await db.query.inspections.findFirst({
        where: and(
          eq(schema.inspections.id, entityId),
          eq(schema.inspections.organisationId, organisationId),
        ),
        columns: { id: true },
      })
      return !!inspection
    }
    case 'operator': {
      const operator = await db.query.users.findFirst({
        where: and(eq(schema.users.id, entityId), eq(schema.users.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!operator
    }
    default:
      return false
  }
}
