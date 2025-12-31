import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import {
  buildSearchCondition,
  buildSearchRank,
  parseDateParam,
  parseTagsParam,
  validateCategory,
  validateEntityType,
} from '../../utils/document-search'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  // Full-text search
  q: z.string().optional(),
  // Filename search (ILIKE)
  name: z.string().optional(),
  // Tags filter
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  // Category filter
  category: z.string().optional(),
  // Date range filters
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // Linked entity filters
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  // Folder filter
  folderId: z.string().uuid().optional(),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Sorting
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'category', 'fileSize', 'relevance'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export default defineEventHandler(async (event) => {
  // Require assets:read permission (documents are related to assets)
  const user = await requirePermission(event, 'assets:read')

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const {
    q: searchQuery,
    name,
    tags,
    category,
    dateFrom,
    dateTo,
    entityType,
    entityId,
    folderId,
    page,
    limit,
    sortBy,
    sortOrder,
  } = result.data

  // Build conditions
  const conditions = [eq(schema.documents.organisationId, user.organisationId)]

  // Full-text search using tsvector
  const hasFullTextSearch = searchQuery && searchQuery.trim() !== ''
  if (hasFullTextSearch) {
    conditions.push(buildSearchCondition(searchQuery))
  }

  // Filename search (ILIKE)
  if (name && name.trim() !== '') {
    conditions.push(ilike(schema.documents.name, `%${name.trim()}%`))
  }

  // Tags filter (array contains)
  const parsedTags = parseTagsParam(tags)
  if (parsedTags && parsedTags.length > 0) {
    // Use @> operator for array contains
    conditions.push(
      sql`${schema.documents.tags} @> ARRAY[${sql.join(
        parsedTags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    )
  }

  // Category filter
  const validCategory = validateCategory(category)
  if (validCategory) {
    conditions.push(eq(schema.documents.category, validCategory))
  }

  // Date range filter on createdAt
  const fromDate = parseDateParam(dateFrom)
  const toDate = parseDateParam(dateTo)

  if (fromDate) {
    conditions.push(gte(schema.documents.createdAt, fromDate))
  }

  if (toDate) {
    // Include the entire end date
    const endOfDay = new Date(toDate)
    endOfDay.setHours(23, 59, 59, 999)
    conditions.push(lte(schema.documents.createdAt, endOfDay))
  }

  // Folder filter
  if (folderId) {
    conditions.push(eq(schema.documents.folderId, folderId))
  }

  // Entity link filter
  const validEntityType = validateEntityType(entityType)
  let linkedDocumentIds: string[] | null = null

  if (validEntityType && entityId) {
    // Get document IDs linked to this entity
    const linkedDocs = await db
      .select({ documentId: schema.documentLinks.documentId })
      .from(schema.documentLinks)
      .where(
        and(
          eq(schema.documentLinks.entityType, validEntityType),
          eq(schema.documentLinks.entityId, entityId),
        ),
      )

    linkedDocumentIds = linkedDocs.map((d) => d.documentId)

    // If no documents linked, return empty result early
    if (linkedDocumentIds.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasMore: false,
        },
      }
    }

    // Add IN condition for linked document IDs
    conditions.push(
      sql`${schema.documents.id} IN (${sql.join(
        linkedDocumentIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    )
  }

  const whereClause = and(...conditions)

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.documents)
    .where(whereClause)

  const total = countResult[0]?.count || 0
  const offset = (page - 1) * limit
  const totalPages = Math.ceil(total / limit)

  // Build order by clause
  let orderByClause

  if (hasFullTextSearch && sortBy === 'relevance') {
    // Sort by relevance (ts_rank) when using full-text search
    const rankExpr = buildSearchRank(searchQuery!)
    orderByClause = sortOrder === 'asc' ? asc(rankExpr) : desc(rankExpr)
  } else {
    // Standard field sorting
    const sortField = sortBy === 'relevance' ? 'createdAt' : sortBy
    const sortFn = sortOrder === 'asc' ? asc : desc

    switch (sortField) {
      case 'name':
        orderByClause = sortFn(schema.documents.name)
        break
      case 'category':
        orderByClause = sortFn(schema.documents.category)
        break
      case 'fileSize':
        orderByClause = sortFn(schema.documents.fileSize)
        break
      case 'updatedAt':
        orderByClause = sortFn(schema.documents.updatedAt)
        break
      default:
        orderByClause = sortFn(schema.documents.createdAt)
    }
  }

  // Fetch documents with relations
  const documents = await db
    .select({
      id: schema.documents.id,
      organisationId: schema.documents.organisationId,
      folderId: schema.documents.folderId,
      name: schema.documents.name,
      originalFilename: schema.documents.originalFilename,
      filePath: schema.documents.filePath,
      mimeType: schema.documents.mimeType,
      fileSize: schema.documents.fileSize,
      description: schema.documents.description,
      category: schema.documents.category,
      tags: schema.documents.tags,
      expiryDate: schema.documents.expiryDate,
      currentVersionId: schema.documents.currentVersionId,
      uploadedById: schema.documents.uploadedById,
      createdAt: schema.documents.createdAt,
      updatedAt: schema.documents.updatedAt,
      // Include rank if doing full-text search
      ...(hasFullTextSearch ? { rank: buildSearchRank(searchQuery!) } : {}),
      // Join uploader info
      uploadedByFirstName: schema.users.firstName,
      uploadedByLastName: schema.users.lastName,
      uploadedByEmail: schema.users.email,
      // Join folder info
      folderName: schema.documentFolders.name,
    })
    .from(schema.documents)
    .leftJoin(schema.users, eq(schema.documents.uploadedById, schema.users.id))
    .leftJoin(schema.documentFolders, eq(schema.documents.folderId, schema.documentFolders.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset)

  // Format response
  const formattedDocuments = documents.map((doc) => ({
    id: doc.id,
    organisationId: doc.organisationId,
    folderId: doc.folderId,
    name: doc.name,
    originalFilename: doc.originalFilename,
    filePath: doc.filePath,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    description: doc.description,
    category: doc.category,
    tags: doc.tags,
    expiryDate: doc.expiryDate,
    currentVersionId: doc.currentVersionId,
    uploadedById: doc.uploadedById,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(hasFullTextSearch ? { rank: doc.rank } : {}),
    uploadedBy: doc.uploadedByFirstName
      ? {
          id: doc.uploadedById,
          firstName: doc.uploadedByFirstName,
          lastName: doc.uploadedByLastName,
          email: doc.uploadedByEmail,
        }
      : null,
    folder: doc.folderName
      ? {
          id: doc.folderId,
          name: doc.folderName,
        }
      : null,
  }))

  return {
    data: formattedDocuments,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  }
})
