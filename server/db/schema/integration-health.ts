import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const integrationTypeEnum = pgEnum('integration_type', [
  'fuel_backend',
  'telematics',
  'erp',
  'accounting',
  'other',
])

export const integrationStatusEnum = pgEnum('integration_status', [
  'healthy',
  'degraded',
  'unhealthy',
  'offline',
  'unknown',
])

/**
 * Tracks health and configuration of external integrations
 */
export const integrationHealth = pgTable(
  'integration_health',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Integration identification
    integrationType: integrationTypeEnum('integration_type').notNull(),
    integrationName: varchar('integration_name', { length: 100 }).notNull(),

    // Current status
    status: integrationStatusEnum('status').notNull().default('unknown'),
    statusMessage: text('status_message'),

    // Health metrics
    lastSuccessfulSync: timestamp('last_successful_sync', { withTimezone: true }),
    lastSyncAttempt: timestamp('last_sync_attempt', { withTimezone: true }),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),

    // Error tracking for circuit breaker pattern
    consecutiveErrors: integer('consecutive_errors').notNull().default(0),
    totalErrors: integer('total_errors').notNull().default(0),
    totalSuccesses: integer('total_successes').notNull().default(0),

    // Sync statistics
    totalRecordsSynced: integer('total_records_synced').notNull().default(0),
    lastSyncRecordCount: integer('last_sync_record_count'),
    lastSyncDurationMs: integer('last_sync_duration_ms'),

    // Configuration (encrypted/masked for display)
    configEndpoint: varchar('config_endpoint', { length: 500 }),
    configEnabled: boolean('config_enabled').notNull().default(true),
    configSyncIntervalMinutes: integer('config_sync_interval_minutes').default(15),

    // Additional config stored as JSON (API keys should be in environment variables)
    configMetadata: jsonb('config_metadata').$type<{
      syncBatchSize?: number
      retryAttempts?: number
      timeoutSeconds?: number
      [key: string]: unknown
    }>(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('integration_health_organisation_id_idx').on(table.organisationId),
    index('integration_health_type_idx').on(table.integrationType),
    index('integration_health_status_idx').on(table.status),
    index('integration_health_org_type_idx').on(table.organisationId, table.integrationType),
  ],
)

export type IntegrationHealth = typeof integrationHealth.$inferSelect
export type NewIntegrationHealth = typeof integrationHealth.$inferInsert

/**
 * Tracks individual sync events for detailed history
 */
export const integrationSyncHistory = pgTable(
  'integration_sync_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationHealthId: uuid('integration_health_id')
      .notNull()
      .references(() => integrationHealth.id, { onDelete: 'cascade' }),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Sync details
    syncType: varchar('sync_type', { length: 50 }).notNull(), // 'manual', 'scheduled', 'webhook'
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),

    // Results
    success: boolean('success'),
    recordsFetched: integer('records_fetched'),
    recordsCreated: integer('records_created'),
    recordsUpdated: integer('records_updated'),
    recordsWithErrors: integer('records_with_errors'),
    discrepanciesFound: integer('discrepancies_found'),

    // Error info
    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details').$type<{
      code?: string
      stack?: string
      response?: unknown
      errors?: Array<{ externalId: string; error: string }>
    }>(),

    // Additional context
    metadata: jsonb('metadata').$type<{
      triggeredBy?: string
      syncWindow?: { from: string; to: string }
      [key: string]: unknown
    }>(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('integration_sync_history_health_id_idx').on(table.integrationHealthId),
    index('integration_sync_history_organisation_id_idx').on(table.organisationId),
    index('integration_sync_history_started_at_idx').on(table.startedAt),
    index('integration_sync_history_success_idx').on(table.success),
  ],
)

export type IntegrationSyncHistory = typeof integrationSyncHistory.$inferSelect
export type NewIntegrationSyncHistory = typeof integrationSyncHistory.$inferInsert
