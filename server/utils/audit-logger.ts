import type { H3Event } from 'h3'
import { getHeader, getRequestIP } from 'h3'
import type { AuditLog, NewAuditLog } from '../db/schema/audit-log'
import { db, schema } from './db'

/**
 * Audit action types for common operations
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'view'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'unassign'
  | 'archive'
  | 'restore'
  | 'upload'
  | 'download'
  | 'move'
  | 'link'
  | 'unlink'
  | 'override'
  | 'clear'
  | 'revert'

/**
 * Options for creating an audit log entry
 */
export interface CreateAuditLogOptions {
  /** Organisation ID - required for multi-tenant isolation */
  organisationId: string
  /** User ID - optional for system operations */
  userId?: string | null
  /** Action performed */
  action: AuditAction | string
  /** Type of entity being audited (e.g., 'user', 'asset', 'work_order') */
  entityType: string
  /** ID of the entity being audited */
  entityId?: string | null
  /** Previous values before the change (for updates/deletes) */
  oldValues?: Record<string, unknown> | null
  /** New values after the change (for creates/updates) */
  newValues?: Record<string, unknown> | null
  /** Client IP address */
  ipAddress?: string | null
  /** Client user agent string */
  userAgent?: string | null
}

/**
 * Request metadata extracted from H3 event
 */
export interface RequestMetadata {
  ipAddress: string | null
  userAgent: string | null
}

/**
 * Extract request metadata (IP address and user agent) from H3 event
 *
 * @param event - H3 event object
 * @returns Object containing ipAddress and userAgent
 *
 * @example
 * ```ts
 * const metadata = getRequestMetadata(event)
 * await createAuditLog({
 *   ...options,
 *   ...metadata,
 * })
 * ```
 */
export function getRequestMetadata(event: H3Event): RequestMetadata {
  return {
    ipAddress: getRequestIP(event) ?? null,
    userAgent: getHeader(event, 'user-agent') ?? null,
  }
}

/**
 * Create an audit log entry
 *
 * This function logs important actions for compliance and debugging purposes.
 * It silently catches and logs errors to prevent audit logging from breaking
 * the main application flow.
 *
 * @param options - Audit log options
 * @returns The created audit log entry, or null if creation failed
 *
 * @example
 * ```ts
 * // Basic usage
 * await createAuditLog({
 *   organisationId: session.user.organisationId,
 *   userId: session.user.id,
 *   action: 'create',
 *   entityType: 'asset',
 *   entityId: asset.id,
 *   newValues: { name: asset.name, category: asset.category },
 *   ...getRequestMetadata(event),
 * })
 *
 * // For system operations (no user)
 * await createAuditLog({
 *   organisationId: org.id,
 *   userId: null,
 *   action: 'import',
 *   entityType: 'asset',
 *   newValues: { importedCount: 50 },
 * })
 *
 * // For updates with old/new values
 * await createAuditLog({
 *   organisationId: session.user.organisationId,
 *   userId: session.user.id,
 *   action: 'update',
 *   entityType: 'work_order',
 *   entityId: workOrder.id,
 *   oldValues: { status: 'pending' },
 *   newValues: { status: 'completed' },
 *   ...getRequestMetadata(event),
 * })
 * ```
 */
export async function createAuditLog(options: CreateAuditLogOptions): Promise<AuditLog | null> {
  try {
    const auditEntry: NewAuditLog = {
      organisationId: options.organisationId,
      userId: options.userId ?? null,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId ?? null,
      oldValues: options.oldValues ?? null,
      newValues: options.newValues ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    }

    const [result] = await db.insert(schema.auditLog).values(auditEntry).returning()

    return result ?? null
  } catch (error) {
    // Log the error but don't throw - audit logging should not break the main flow
    console.error('[AuditLogger] Failed to create audit log entry:', {
      error: error instanceof Error ? error.message : String(error),
      options: {
        organisationId: options.organisationId,
        userId: options.userId,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
      },
    })

    return null
  }
}

/**
 * Create an audit log entry with request metadata extracted from H3 event
 *
 * This is a convenience function that combines createAuditLog with getRequestMetadata.
 *
 * @param event - H3 event object
 * @param options - Audit log options (without ipAddress and userAgent)
 * @returns The created audit log entry, or null if creation failed
 *
 * @example
 * ```ts
 * await createAuditLogFromEvent(event, {
 *   organisationId: session.user.organisationId,
 *   userId: session.user.id,
 *   action: 'delete',
 *   entityType: 'document',
 *   entityId: documentId,
 *   oldValues: { name: document.name },
 * })
 * ```
 */
export async function createAuditLogFromEvent(
  event: H3Event,
  options: Omit<CreateAuditLogOptions, 'ipAddress' | 'userAgent'>,
): Promise<AuditLog | null> {
  const metadata = getRequestMetadata(event)

  return createAuditLog({
    ...options,
    ...metadata,
  })
}

/**
 * Nuxt server utility composable for audit logging
 *
 * This can be used in Nuxt server routes via auto-import.
 *
 * @returns Object with audit logging functions
 *
 * @example
 * ```ts
 * // In a server route
 * export default defineEventHandler(async (event) => {
 *   const { logAudit, logAuditFromEvent } = useAuditLogger()
 *
 *   // ... perform operation ...
 *
 *   await logAuditFromEvent(event, {
 *     organisationId: session.user.organisationId,
 *     userId: session.user.id,
 *     action: 'create',
 *     entityType: 'asset',
 *     entityId: asset.id,
 *   })
 * })
 * ```
 */
export function useAuditLogger() {
  return {
    /** Create an audit log entry */
    logAudit: createAuditLog,
    /** Create an audit log entry with request metadata from H3 event */
    logAuditFromEvent: createAuditLogFromEvent,
    /** Extract request metadata from H3 event */
    getRequestMetadata,
  }
}
