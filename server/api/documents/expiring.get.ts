import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

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
        eq(schema.assets.organisationId, session.user.organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        gte(schema.assetDocuments.expiryDate, now),
        lte(schema.assetDocuments.expiryDate, futureDate),
      ),
    )
    .orderBy(schema.assetDocuments.expiryDate)

  const filteredDocuments = expiringDocuments

  return {
    data: filteredDocuments,
    count: filteredDocuments.length,
    days: result.data.days,
  }
})
