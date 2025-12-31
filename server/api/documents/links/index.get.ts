import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { getPreviewUrl } from '../../../utils/document-preview'

const querySchema = z.object({
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

  const user = session.user
  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { entityType, entityId } = result.data

  // Verify entity exists and belongs to organisation
  const entityExists = await verifyEntityExists(entityType, entityId, user.organisationId)

  if (!entityExists) {
    throw createError({
      statusCode: 404,
      statusMessage: `${entityType.charAt(0).toUpperCase() + entityType.slice(1).replace('_', ' ')} not found`,
    })
  }

  // Get all document links for this entity with document details
  const links = await db.query.documentLinks.findMany({
    where: and(
      eq(schema.documentLinks.entityType, entityType),
      eq(schema.documentLinks.entityId, entityId),
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

  // Filter out links where document doesn't belong to organisation
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
          ...link,
          document: {
            ...link.document,
            previewUrl: getPreviewUrl(link.document.mimeType, link.document.filePath),
          },
        }
      }),
  )

  return documentsWithPreview.filter(Boolean)
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
