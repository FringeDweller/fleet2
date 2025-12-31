import type { SQL } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { H3Event } from 'h3'
import {
  type AuditAction,
  type CreateAuditLogOptions,
  createAuditLogFromEvent,
} from './audit-logger'
import { db, schema } from './db'

/**
 * Options for audited database operations
 */
export interface AuditedOperationOptions {
  /** Skip audit logging for this operation (e.g., for bulk operations) */
  skipAudit?: boolean
  /** Override the default entity type (table name) */
  entityType?: string
  /** Additional context to include in audit log */
  metadata?: Record<string, unknown>
}

/**
 * Session context required for audited operations
 */
export interface AuditContext {
  organisationId: string
  userId: string
}

/**
 * Get the table name from a Drizzle table for use as entity type
 */
function getTableName(table: PgTable<TableConfig>): string {
  // Access the internal symbol that stores table config
  const tableConfig = (table as unknown as { [key: symbol]: { name: string } })[
    Symbol.for('drizzle:Name')
  ]
  return tableConfig?.name ?? 'unknown'
}

/**
 * Extract the ID from a record if it has one
 */
function extractId(record: Record<string, unknown>): string | null {
  if ('id' in record && typeof record.id === 'string') {
    return record.id
  }
  return null
}

/**
 * Sanitize values for audit logging by removing sensitive fields
 * and handling circular references
 */
function sanitizeForAudit(values: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'passwordHash', 'secret', 'token', 'apiKey']

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(values)) {
    // Skip sensitive fields
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Handle Date objects
    if (value instanceof Date) {
      sanitized[key] = value.toISOString()
      continue
    }

    // Handle primitive values and arrays/objects
    sanitized[key] = value
  }

  return sanitized
}

/**
 * Perform an INSERT operation with automatic audit logging
 *
 * @param event - H3 event for request metadata extraction
 * @param context - Session context with organisation and user IDs
 * @param table - Drizzle table to insert into
 * @param values - Values to insert
 * @param options - Optional configuration for audit behavior
 * @returns The inserted record(s)
 *
 * @example
 * ```ts
 * const [asset] = await auditedInsert(
 *   event,
 *   { organisationId: session.user.organisationId, userId: session.user.id },
 *   schema.assets,
 *   { assetNumber: 'A001', name: 'Truck 1' }
 * )
 * ```
 */
export async function auditedInsert<T extends PgTable<TableConfig>>(
  event: H3Event,
  context: AuditContext,
  table: T,
  values: T['$inferInsert'],
  options: AuditedOperationOptions = {},
): Promise<T['$inferSelect'][]> {
  // Perform the insert
  const results = await db.insert(table).values(values).returning()

  // Log audit entry for each inserted record
  if (!options.skipAudit && results.length > 0) {
    const entityType = options.entityType ?? getTableName(table)

    for (const result of results) {
      const record = result as Record<string, unknown>
      await createAuditLogFromEvent(event, {
        organisationId: context.organisationId,
        userId: context.userId,
        action: 'create' as AuditAction,
        entityType,
        entityId: extractId(record),
        newValues: sanitizeForAudit(record),
      })
    }
  }

  return results as T['$inferSelect'][]
}

/**
 * Perform an UPDATE operation with automatic audit logging
 *
 * This function fetches the old values before updating to capture the change.
 *
 * @param event - H3 event for request metadata extraction
 * @param context - Session context with organisation and user IDs
 * @param table - Drizzle table to update
 * @param where - SQL condition for which records to update
 * @param values - Values to update
 * @param options - Optional configuration for audit behavior
 * @returns The updated record(s)
 *
 * @example
 * ```ts
 * const [updatedAsset] = await auditedUpdate(
 *   event,
 *   { organisationId: session.user.organisationId, userId: session.user.id },
 *   schema.assets,
 *   eq(schema.assets.id, assetId),
 *   { status: 'maintenance' }
 * )
 * ```
 */
export async function auditedUpdate<T extends PgTable<TableConfig>>(
  event: H3Event,
  context: AuditContext,
  table: T,
  where: SQL,
  values: Partial<T['$inferInsert']>,
  options: AuditedOperationOptions = {},
): Promise<T['$inferSelect'][]> {
  const entityType = options.entityType ?? getTableName(table)

  // Fetch old values before update for audit comparison
  let oldRecords: Record<string, unknown>[] = []
  if (!options.skipAudit) {
    // Note: Type assertion needed due to Drizzle ORM generics complexity
    oldRecords = (await db
      .select()
      .from(table as unknown as PgTable<TableConfig>)
      .where(where)) as Record<string, unknown>[]
  }

  // Perform the update
  const results = await db.update(table).set(values).where(where).returning()

  // Log audit entries
  if (!options.skipAudit && results.length > 0) {
    for (let i = 0; i < results.length; i++) {
      const newRecord = results[i] as Record<string, unknown>
      const oldRecord = oldRecords[i]

      await createAuditLogFromEvent(event, {
        organisationId: context.organisationId,
        userId: context.userId,
        action: 'update' as AuditAction,
        entityType,
        entityId: extractId(newRecord),
        oldValues: oldRecord ? sanitizeForAudit(oldRecord) : null,
        newValues: sanitizeForAudit(newRecord),
      })
    }
  }

  return results as T['$inferSelect'][]
}

/**
 * Perform a DELETE operation with automatic audit logging
 *
 * This function fetches the records before deleting to capture what was deleted.
 *
 * @param event - H3 event for request metadata extraction
 * @param context - Session context with organisation and user IDs
 * @param table - Drizzle table to delete from
 * @param where - SQL condition for which records to delete
 * @param options - Optional configuration for audit behavior
 * @returns The deleted record(s)
 *
 * @example
 * ```ts
 * const [deletedAsset] = await auditedDelete(
 *   event,
 *   { organisationId: session.user.organisationId, userId: session.user.id },
 *   schema.assets,
 *   eq(schema.assets.id, assetId)
 * )
 * ```
 */
export async function auditedDelete<T extends PgTable<TableConfig>>(
  event: H3Event,
  context: AuditContext,
  table: T,
  where: SQL,
  options: AuditedOperationOptions = {},
): Promise<T['$inferSelect'][]> {
  const entityType = options.entityType ?? getTableName(table)

  // Fetch records before deletion for audit logging
  let recordsToDelete: Record<string, unknown>[] = []
  if (!options.skipAudit) {
    // Note: Type assertion needed due to Drizzle ORM generics complexity
    recordsToDelete = (await db
      .select()
      .from(table as unknown as PgTable<TableConfig>)
      .where(where)) as Record<string, unknown>[]
  }

  // Perform the delete
  const results = await db.delete(table).where(where).returning()

  // Log audit entries for deleted records
  if (!options.skipAudit && recordsToDelete.length > 0) {
    for (const record of recordsToDelete) {
      await createAuditLogFromEvent(event, {
        organisationId: context.organisationId,
        userId: context.userId,
        action: 'delete' as AuditAction,
        entityType,
        entityId: extractId(record),
        oldValues: sanitizeForAudit(record),
        newValues: null,
      })
    }
  }

  return results as T['$inferSelect'][]
}

/**
 * Batch insert multiple records with a single audit log entry
 *
 * Use this for bulk operations where individual audit entries would be too verbose.
 *
 * @param event - H3 event for request metadata extraction
 * @param context - Session context with organisation and user IDs
 * @param table - Drizzle table to insert into
 * @param values - Array of values to insert
 * @param options - Optional configuration for audit behavior
 * @returns The inserted records
 *
 * @example
 * ```ts
 * const assets = await auditedBatchInsert(
 *   event,
 *   { organisationId, userId },
 *   schema.assets,
 *   [{ assetNumber: 'A001' }, { assetNumber: 'A002' }]
 * )
 * ```
 */
export async function auditedBatchInsert<T extends PgTable<TableConfig>>(
  event: H3Event,
  context: AuditContext,
  table: T,
  values: T['$inferInsert'][],
  options: AuditedOperationOptions = {},
): Promise<T['$inferSelect'][]> {
  if (values.length === 0) {
    return []
  }

  // Perform the batch insert
  const results = await db.insert(table).values(values).returning()

  // Log a single audit entry for the batch operation
  if (!options.skipAudit && results.length > 0) {
    const entityType = options.entityType ?? getTableName(table)
    const ids = results.map((r) => extractId(r as Record<string, unknown>)).filter(Boolean)

    await createAuditLogFromEvent(event, {
      organisationId: context.organisationId,
      userId: context.userId,
      action: 'import' as AuditAction,
      entityType,
      entityId: null,
      newValues: {
        count: results.length,
        ids,
        ...options.metadata,
      },
    })
  }

  return results as T['$inferSelect'][]
}

/**
 * Create an audited database client scoped to a specific session
 *
 * This provides a convenient way to use audited operations without passing
 * event and context to every call.
 *
 * @param event - H3 event for request metadata extraction
 * @param context - Session context with organisation and user IDs
 * @returns Object with audited database operations
 *
 * @example
 * ```ts
 * const auditedDb = useAuditedDb(event, {
 *   organisationId: session.user.organisationId,
 *   userId: session.user.id,
 * })
 *
 * const [asset] = await auditedDb.insert(schema.assets, { assetNumber: 'A001' })
 * await auditedDb.update(schema.assets, eq(schema.assets.id, id), { status: 'active' })
 * await auditedDb.delete(schema.assets, eq(schema.assets.id, id))
 * ```
 */
export function useAuditedDb(event: H3Event, context: AuditContext) {
  return {
    /**
     * Insert a record with automatic audit logging
     */
    insert: <T extends PgTable<TableConfig>>(
      table: T,
      values: T['$inferInsert'],
      options?: AuditedOperationOptions,
    ) => auditedInsert(event, context, table, values, options),

    /**
     * Update records with automatic audit logging
     */
    update: <T extends PgTable<TableConfig>>(
      table: T,
      where: SQL,
      values: Partial<T['$inferInsert']>,
      options?: AuditedOperationOptions,
    ) => auditedUpdate(event, context, table, where, values, options),

    /**
     * Delete records with automatic audit logging
     */
    delete: <T extends PgTable<TableConfig>>(
      table: T,
      where: SQL,
      options?: AuditedOperationOptions,
    ) => auditedDelete(event, context, table, where, options),

    /**
     * Batch insert records with a single audit log entry
     */
    batchInsert: <T extends PgTable<TableConfig>>(
      table: T,
      values: T['$inferInsert'][],
      options?: AuditedOperationOptions,
    ) => auditedBatchInsert(event, context, table, values, options),
  }
}
