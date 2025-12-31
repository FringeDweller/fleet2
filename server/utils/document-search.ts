import { sql } from 'drizzle-orm'
import type { NewDocument } from '../db/schema/documents'

/**
 * Generate a tsvector value from document fields for full-text search.
 * Combines name, description, and tags with appropriate weights:
 * - A (highest): name
 * - B (medium): tags
 * - C (lower): description
 *
 * @param name - Document name
 * @param description - Document description (optional)
 * @param tags - Document tags array (optional)
 * @returns SQL expression to generate tsvector
 */
export function generateSearchVector(
  name: string,
  description?: string | null,
  tags?: string[] | null,
) {
  // Prepare text values, escaping single quotes
  const safeName = name.replace(/'/g, "''")
  const safeDescription = description?.replace(/'/g, "''") || ''
  const safeTags = tags?.map((t) => t.replace(/'/g, "''")).join(' ') || ''

  // Generate weighted tsvector
  // A = highest weight (name)
  // B = medium weight (tags)
  // C = lower weight (description)
  return sql`
    setweight(to_tsvector('english', ${safeName}), 'A') ||
    setweight(to_tsvector('english', ${safeTags}), 'B') ||
    setweight(to_tsvector('english', ${safeDescription}), 'C')
  `
}

/**
 * Create a raw SQL expression for updating searchVector during insert/update.
 * This is used when directly setting the searchVector column value.
 *
 * @param doc - Document data containing name, description, and tags
 * @returns SQL string for the searchVector value
 */
export function buildSearchVectorSql(doc: {
  name: string
  description?: string | null
  tags?: string[] | null
}): ReturnType<typeof sql> {
  return generateSearchVector(doc.name, doc.description, doc.tags)
}

/**
 * Create a plainto_tsquery for search.
 * Converts plain text to a tsquery suitable for matching against tsvector.
 *
 * @param searchTerm - The search term from user input
 * @returns SQL expression for tsquery
 */
export function buildSearchQuery(searchTerm: string) {
  const safeSearch = searchTerm.replace(/'/g, "''")
  return sql`plainto_tsquery('english', ${safeSearch})`
}

/**
 * Create a ts_rank expression for ordering results by relevance.
 * Higher ranks indicate better matches.
 *
 * @param searchTerm - The search term to rank against
 * @param vectorColumn - The tsvector column (defaults to search_vector)
 * @returns SQL expression for ranking
 */
export function buildSearchRank(searchTerm: string) {
  const safeSearch = searchTerm.replace(/'/g, "''")
  return sql<number>`ts_rank(search_vector, plainto_tsquery('english', ${safeSearch}))`
}

/**
 * Create a WHERE condition for full-text search.
 *
 * @param searchTerm - The search term to match
 * @returns SQL expression for matching
 */
export function buildSearchCondition(searchTerm: string) {
  const safeSearch = searchTerm.replace(/'/g, "''")
  return sql`search_vector @@ plainto_tsquery('english', ${safeSearch})`
}

/**
 * Parse date string to Date object, returning undefined if invalid.
 *
 * @param dateString - ISO date string or undefined
 * @returns Date object or undefined
 */
export function parseDateParam(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Validate document category against allowed values.
 *
 * @param category - Category string to validate
 * @returns Validated category or undefined
 */
export function validateCategory(
  category: string | undefined,
): NonNullable<NewDocument['category']> | undefined {
  const validCategories = [
    'registration',
    'insurance',
    'inspection',
    'certification',
    'manual',
    'warranty',
    'invoice',
    'contract',
    'report',
    'other',
  ] as const

  if (!category) return undefined
  return validCategories.includes(category as (typeof validCategories)[number])
    ? (category as (typeof validCategories)[number])
    : undefined
}

/**
 * Validate entity type for document links.
 *
 * @param entityType - Entity type string to validate
 * @returns Validated entity type or undefined
 */
export function validateEntityType(
  entityType: string | undefined,
): 'asset' | 'work_order' | 'part' | 'inspection' | 'operator' | undefined {
  const validTypes = ['asset', 'work_order', 'part', 'inspection', 'operator'] as const

  if (!entityType) return undefined
  return validTypes.includes(entityType as (typeof validTypes)[number])
    ? (entityType as (typeof validTypes)[number])
    : undefined
}

/**
 * Parse tags query parameter.
 * Accepts comma-separated string or array.
 *
 * @param tagsParam - Tags query parameter
 * @returns Array of tags or undefined
 */
export function parseTagsParam(tagsParam: string | string[] | undefined): string[] | undefined {
  if (!tagsParam) return undefined

  if (Array.isArray(tagsParam)) {
    return tagsParam.filter((t) => t.trim() !== '')
  }

  return tagsParam
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}
