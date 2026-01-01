/**
 * US-15.6: Get expiring documents
 * GET /api/documents/expiring?days=30&category=registration&limit=50
 *
 * Returns documents that will expire within the specified number of days.
 * Includes expiry status and urgency level for each document.
 *
 * Query params:
 * - days: number of days until expiry (default: 30, max: 365)
 * - category: filter by document type (registration, insurance, inspection, etc.)
 * - limit: max number of results (default: 100, max: 500)
 */
import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

// Valid document type categories
const documentTypes = [
  'registration',
  'insurance',
  'inspection',
  'certification',
  'manual',
  'warranty',
  'other',
] as const

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  category: z.enum(documentTypes).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export default defineEventHandler(async (event) => {
  // Require authentication to view expiring documents
  const currentUser = await requireAuth(event)

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { days, category, limit } = result.data

  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  // Build where conditions
  const conditions = [
    eq(schema.assets.organisationId, currentUser.organisationId),
    isNotNull(schema.assetDocuments.expiryDate),
    gte(schema.assetDocuments.expiryDate, now),
    lte(schema.assetDocuments.expiryDate, futureDate),
  ]

  // Add category filter if provided
  if (category) {
    conditions.push(eq(schema.assetDocuments.documentType, category))
  }

  // Find documents expiring within the specified days
  // Join with assets to filter by organisation
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
    .where(and(...conditions))
    .orderBy(asc(schema.assetDocuments.expiryDate))
    .limit(limit)

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
      name: doc.name,
      category: doc.documentType,
      expiryDate: doc.expiryDate,
      daysUntilExpiry,
      // Additional details
      assetId: doc.assetId,
      filePath: doc.filePath,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      description: doc.description,
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
      expiryStatus: 'expiring_soon' as const,
      urgency,
    }
  })

  return {
    data: documentsWithDetails,
    count: documentsWithDetails.length,
    filters: {
      days,
      category: category || null,
      limit,
    },
  }
})
