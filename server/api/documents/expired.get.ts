/**
 * US-15.6: Get expired documents
 * GET /api/documents/expired
 *
 * Returns all documents that have already expired (expiryDate < now).
 */
import { and, asc, eq, isNotNull, lt } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require assets:read permission to view expired documents
  const currentUser = await requirePermission(event, 'assets:read')

  const now = new Date()

  // Find all expired documents for this organisation
  const expiredDocuments = await db
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
        lt(schema.assetDocuments.expiryDate, now),
      ),
    )
    .orderBy(asc(schema.assetDocuments.expiryDate))

  // Add details to each document
  const documentsWithDetails = expiredDocuments.map((doc) => {
    const daysSinceExpiry = doc.expiryDate
      ? Math.ceil((now.getTime() - doc.expiryDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

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
      daysSinceExpiry,
      expiryStatus: 'expired' as const,
    }
  })

  return {
    data: documentsWithDetails,
    count: documentsWithDetails.length,
  }
})
