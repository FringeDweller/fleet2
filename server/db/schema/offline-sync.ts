import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Enum for sync operation types
 */
export const syncTypeEnum = pgEnum('sync_type', ['full', 'incremental', 'conflict_resolution'])

/**
 * Enum for sync operation status
 */
export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
])

/**
 * Enum for pending change operations
 */
export const syncOperationEnum = pgEnum('sync_operation', ['create', 'update', 'delete'])

/**
 * Enum for conflict resolution strategies
 */
export const conflictResolutionEnum = pgEnum('conflict_resolution', [
  'client_wins',
  'server_wins',
  'manual',
  'merge',
])

/**
 * Tracks sync operations between client devices and server
 */
export const syncOperations = pgTable(
  'sync_operations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: varchar('device_id', { length: 255 }).notNull(),
    syncType: syncTypeEnum('sync_type').notNull(),
    status: syncStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<{
      recordsSynced?: number
      recordsFailed?: number
      conflictsResolved?: number
      durationMs?: number
      clientVersion?: string
      [key: string]: unknown
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sync_operations_user_id_idx').on(table.userId),
    index('sync_operations_device_id_idx').on(table.deviceId),
    index('sync_operations_status_idx').on(table.status),
    index('sync_operations_user_device_idx').on(table.userId, table.deviceId),
    index('sync_operations_started_at_idx').on(table.startedAt),
  ],
)

export type SyncOperation = typeof syncOperations.$inferSelect
export type NewSyncOperation = typeof syncOperations.$inferInsert

/**
 * Queue for pending changes that need to be synced to the server
 */
export const pendingChanges = pgTable(
  'pending_changes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    operation: syncOperationEnum('operation').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    conflictResolution: conflictResolutionEnum('conflict_resolution'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('pending_changes_user_id_idx').on(table.userId),
    index('pending_changes_entity_type_idx').on(table.entityType),
    index('pending_changes_entity_id_idx').on(table.entityId),
    index('pending_changes_synced_at_idx').on(table.syncedAt),
    index('pending_changes_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    index('pending_changes_created_at_idx').on(table.createdAt),
  ],
)

export type PendingChange = typeof pendingChanges.$inferSelect
export type NewPendingChange = typeof pendingChanges.$inferInsert

/**
 * Tracks last sync timestamp per user/device combination
 */
export const syncMetadata = pgTable(
  'sync_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: varchar('device_id', { length: 255 }).notNull(),
    lastSyncTimestamp: timestamp('last_sync_timestamp', { withTimezone: true }).notNull(),
    lastFullSyncAt: timestamp('last_full_sync_at', { withTimezone: true }),
    syncVersion: varchar('sync_version', { length: 50 }),
    metadata: jsonb('metadata').$type<{
      deviceName?: string
      deviceType?: string
      appVersion?: string
      osVersion?: string
      [key: string]: unknown
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sync_metadata_user_id_idx').on(table.userId),
    index('sync_metadata_device_id_idx').on(table.deviceId),
    index('sync_metadata_user_device_idx').on(table.userId, table.deviceId),
    index('sync_metadata_last_sync_idx').on(table.lastSyncTimestamp),
  ],
)

export type SyncMetadata = typeof syncMetadata.$inferSelect
export type NewSyncMetadata = typeof syncMetadata.$inferInsert
