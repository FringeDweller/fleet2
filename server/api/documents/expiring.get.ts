/**
 * US-15.6: Get expiring documents
 * GET /api/documents/expiring?days=30
 *
 * Returns documents that will expire within the specified number of days.
 * Includes expiry status and urgency level for each document.
 */
import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export default defineEventHandler(async (event) => {
  // Require assets:read permission to view expiring documents
  const currentUser = await requirePermission(event, 'assets:read')

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + result.data.days)

  // Find documents expiring within the specified days
  // First get the documents, then join with assets to filter by organisation
  const expiringDocuments = await db
    .select({
      id: schema.assetDocuments.id,
      assetId: schema.assetDocuments.assetId,
      name: schema.assetDocuments.name,
      filePath: schema.assetDocuments.filePath,
      fileType: schema.assetDocuments.fileType,
      fileSize: schema.assetDocuments.fileSize,
      description: schema.assetDocuments.description,
      documentType: schema.assetDocuments.documentType,
      expiryDate: schema.assetDocuments.expiryDate,
      uploadedById: schema.assetDocuments.uploadedById,
      createdAt: schema.assetDocuments.createdAt,
      updatedAt: schema.assetDocuments.updatedAt,
      assetNumber: schema.assets.assetNumber,
      assetMake: schema.assets.make,
      assetModel: schema.assets.model,
      uploadedByFirstName: schema.users.firstName,
      uploadedByLastName: schema.users.lastName,
    })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .leftJoin(schema.users, eq(schema.assetDocuments.uploadedById, schema.users.id))
    .where(
      and(
        eq(schema.assets.organisationId, currentUser.organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        gte(schema.assetDocuments.expiryDate, now),
        lte(schema.assetDocuments.expiryDate, futureDate),
      ),
    )
    .orderBy(asc(schema.assetDocuments.expiryDate))

  // Add expiry details to each document
  const documentsWithDetails = expiringDocuments.map((doc) => {
    const daysUntilExpiry = doc.expiryDate
      ? Math.ceil((doc.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Determine urgency level based on days until expiry
    let urgency: 'critical' | 'warning' | 'info' = 'info'
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= 7) {
        urgency = 'critical'
      } else if (daysUntilExpiry <= 14) {
        urgency = 'warning'
      }
    }

    return {
      id: doc.id,
      assetId: doc.assetId,
      name: doc.name,
      filePath: doc.filePath,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      description: doc.description,
      documentType: doc.documentType,
      expiryDate: doc.expiryDate,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      assetNumber: doc.assetNumber,
      assetMake: doc.assetMake,
      assetModel: doc.assetModel,
      uploadedByName:
        doc.uploadedByFirstName && doc.uploadedByLastName
          ? `${doc.uploadedByFirstName} ${doc.uploadedByLastName}`
          : null,
      daysUntilExpiry,
      expiryStatus: 'expiring_soon' as const,
      urgency,
    }
  })

  return {
    data: documentsWithDetails,
    count: documentsWithDetails.length,
    days: result.data.days,
  }
})
