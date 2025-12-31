/**
 * Input Validation Utilities
 *
 * Provides common validation functions and sanitization utilities
 * for preventing SQL injection and XSS attacks.
 *
 * Key principles:
 * - All database queries use Drizzle ORM's parameterized queries
 * - All user input is validated with Zod schemas
 * - HTML content is encoded before rendering
 *
 * @see US-18.2.3 SQL Injection Prevention
 * @see US-18.2.4 XSS Prevention
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Common Validation Schemas
// -----------------------------------------------------------------------------

/**
 * UUID validation schema
 * Ensures the string is a valid UUID v4 format
 */
export const uuidSchema = z.string().uuid('Invalid ID format')

/**
 * Email validation schema with normalization
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .transform((val) => val.toLowerCase().trim())

/**
 * Safe string schema (no HTML or script content)
 * Strips potentially dangerous characters
 */
export const safeStringSchema = z
  .string()
  .transform((val) => sanitizeString(val))
  .refine((val) => !containsHtmlTags(val), {
    message: 'HTML content is not allowed',
  })

/**
 * Phone number validation schema
 * Allows international formats
 */
export const phoneSchema = z
  .string()
  .regex(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/,
    'Invalid phone number format',
  )
  .optional()
  .nullable()

/**
 * Pagination validation schema
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .default('50')
    .transform((val) => Math.min(Math.max(Number.parseInt(val, 10) || 50, 1), 100)),
  offset: z
    .string()
    .default('0')
    .transform((val) => Math.max(Number.parseInt(val, 10) || 0, 0)),
})

/**
 * Date range validation schema
 */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate)
      }
      return true
    },
    {
      message: 'Start date must be before or equal to end date',
    },
  )

/**
 * Search query validation schema
 * Limits length and strips potentially dangerous patterns
 */
export const searchQuerySchema = z
  .string()
  .max(200, 'Search query too long')
  .transform((val) => sanitizeSearchQuery(val))

/**
 * Sort order validation schema
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

// -----------------------------------------------------------------------------
// Sanitization Functions
// -----------------------------------------------------------------------------

/**
 * Sanitize a string by removing potentially dangerous characters
 * while preserving readability
 */
export function sanitizeString(input: string): string {
  if (!input) return ''

  return (
    input
      // Trim whitespace
      .trim()
      // Normalize unicode characters
      .normalize('NFC')
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except newlines and tabs
      // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  )
}

/**
 * Sanitize search query by removing SQL-like patterns
 * Note: This is a defense-in-depth measure; Drizzle ORM already
 * uses parameterized queries which prevent SQL injection
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input) return ''

  return (
    sanitizeString(input)
      // Remove common SQL injection patterns
      .replace(/['";]/g, '')
      // Remove SQL comments
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      // Limit consecutive wildcards
      .replace(/%{2,}/g, '%')
      .replace(/_{2,}/g, '_')
  )
}

/**
 * Check if a string contains HTML tags
 */
export function containsHtmlTags(input: string): boolean {
  const htmlTagPattern = /<[^>]*>/
  return htmlTagPattern.test(input)
}

/**
 * Encode HTML entities to prevent XSS
 * Use this when displaying user-provided content
 */
export function encodeHtml(input: string): string {
  if (!input) return ''

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  }

  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char)
}

/**
 * Encode content for safe inclusion in HTML attributes
 */
export function encodeAttribute(input: string): string {
  if (!input) return ''

  return encodeHtml(input).replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;')
}

/**
 * Encode content for safe inclusion in JavaScript strings
 */
export function encodeJavaScript(input: string): string {
  if (!input) return ''

  const jsEntities: Record<string, string> = {
    '\\': '\\\\',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '"': '\\"',
    "'": "\\'",
    '<': '\\u003C',
    '>': '\\u003E',
    '&': '\\u0026',
  }

  return input.replace(/[\\\n\r\t"'<>&]/g, (char) => jsEntities[char] || char)
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(input: string): string {
  if (!input) return ''

  const trimmed = input.trim().toLowerCase()

  // Block dangerous URL schemes
  const dangerousSchemes = ['javascript:', 'vbscript:', 'data:', 'file:']

  for (const scheme of dangerousSchemes) {
    if (trimmed.startsWith(scheme)) {
      return '' // Return empty string for dangerous URLs
    }
  }

  // Allow only http, https, mailto, and relative URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('/') ||
    !trimmed.includes(':')
  ) {
    return input.trim()
  }

  return '' // Block unknown schemes
}

/**
 * Validate and sanitize file name
 * Removes path traversal attempts and dangerous characters
 */
export function sanitizeFileName(input: string): string {
  if (!input) return ''

  return (
    input
      // Remove path separators
      .replace(/[/\\]/g, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove other dangerous characters
      .replace(/[<>:"|?*]/g, '')
      // Prevent path traversal
      .replace(/\.\./g, '')
      // Trim and limit length
      .trim()
      .slice(0, 255)
  )
}

// -----------------------------------------------------------------------------
// Request Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Validate request body against a Zod schema
 * Throws a 400 error if validation fails
 */
export async function validateBody<T extends z.ZodSchema>(
  event: H3Event,
  schema: T,
): Promise<z.infer<T>> {
  const body = await readBody(event)

  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      message: 'Invalid request body',
      data: {
        errors: result.error.flatten().fieldErrors,
      },
    })
  }

  return result.data
}

/**
 * Validate query parameters against a Zod schema
 * Throws a 400 error if validation fails
 */
export function validateQuery<T extends z.ZodSchema>(event: H3Event, schema: T): z.infer<T> {
  const query = getQuery(event)

  const result = schema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      message: 'Invalid query parameters',
      data: {
        errors: result.error.flatten().fieldErrors,
      },
    })
  }

  return result.data
}

/**
 * Validate route parameters against a Zod schema
 * Throws a 400 error if validation fails
 */
export function validateParams<T extends z.ZodSchema>(event: H3Event, schema: T): z.infer<T> {
  const params = event.context.params || {}

  const result = schema.safeParse(params)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      message: 'Invalid route parameters',
      data: {
        errors: result.error.flatten().fieldErrors,
      },
    })
  }

  return result.data
}

// Re-export H3Event type for convenience
import type { H3Event } from 'h3'
