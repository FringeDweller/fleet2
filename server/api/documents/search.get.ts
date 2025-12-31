import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
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
  // Full-text search query (required for search endpoint)
  q: z.string().min(1, 'Search query is required'),
  // Optional filters
  name: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  // Search mode: 'all' matches all words, 'any' matches any word
  mode: z.enum(['all', 'any']).default('all'),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Minimum relevance score (0-1)
  minScore: z.coerce.number().min(0).max(1).optional(),
})

export default defineEventHandler(async (event) => {
  // Require assets:read permission
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
    mode,
    page,
    limit,
    minScore,
  } = result.data

  // Build conditions
  const conditions = [eq(schema.documents.organisationId, user.organisationId)]

  // Full-text search - use different tsquery based on mode
  const searchTerms = searchQuery.trim()
  const safeSearch = searchTerms.replace(/'/g, "''")

  if (mode === 'any') {
    // Use plainto_tsquery (default OR behavior when combined with '|')
    // Split terms and combine with OR
    const terms = searchTerms.split(/\s+/).filter((t) => t)
    if (terms.length > 1) {
      const tsqueryExpr = terms.map((t) => t.replace(/'/g, "''")).join(' | ')
      conditions.push(sql`search_vector @@ to_tsquery('english', ${tsqueryExpr})`)
    } else {
      conditions.push(buildSearchCondition(searchTerms))
    }
  } else {
    // Default 'all' mode - use plainto_tsquery which requires all terms
    conditions.push(buildSearchCondition(searchTerms))
  }

  // Additional filters

  // Filename search (ILIKE) - in addition to full-text
  if (name && name.trim() !== '') {
    conditions.push(ilike(schema.documents.name, `%${name.trim()}%`))
  }

  // Tags filter
  const parsedTags = parseTagsParam(tags)
  if (parsedTags && parsedTags.length > 0) {
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

  // Date range
  const fromDate = parseDateParam(dateFrom)
  const toDate = parseDateParam(dateTo)

  if (fromDate) {
    conditions.push(gte(schema.documents.createdAt, fromDate))
  }

  if (toDate) {
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
  if (validEntityType && entityId) {
    const linkedDocs = await db
      .select({ documentId: schema.documentLinks.documentId })
      .from(schema.documentLinks)
      .where(
        and(
          eq(schema.documentLinks.entityType, validEntityType),
          eq(schema.documentLinks.entityId, entityId),
        ),
      )

    const linkedDocumentIds = linkedDocs.map((d) => d.documentId)

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
        searchInfo: {
          query: searchQuery,
          mode,
          matchCount: 0,
        },
      }
    }

    conditions.push(
      sql`${schema.documents.id} IN (${sql.join(
        linkedDocumentIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    )
  }

  // Minimum score filter
  if (minScore !== undefined) {
    const rankExpr = buildSearchRank(searchTerms)
    conditions.push(sql`${rankExpr} >= ${minScore}`)
  }

  const whereClause = and(...conditions)

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.documents)
    .where(whereClause)

  const total = countResult[0]?.count || 0
  const offset = (page - 1) * limit
  const totalPages = Math.ceil(total / limit)

  // Fetch documents ordered by relevance
  const rankExpr = buildSearchRank(searchTerms)

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
      rank: rankExpr,
      // Headline snippet - shows matching text with highlighting markers
      headline: sql<string>`ts_headline(
        'english',
        COALESCE(${schema.documents.name}, '') || ' ' || COALESCE(${schema.documents.description}, ''),
        plainto_tsquery('english', ${safeSearch}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2'
      )`,
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
    .orderBy(desc(rankExpr))
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
    rank: doc.rank,
    headline: doc.headline,
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
    searchInfo: {
      query: searchQuery,
      mode,
      matchCount: total,
    },
  }
})
