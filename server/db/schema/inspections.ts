import {
  decimal,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { inspectionTemplates } from './inspection-templates'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'
import { users } from './users'

export const inspectionStatusEnum = pgEnum('inspection_status', [
  'in_progress',
  'completed',
  'cancelled',
])

export const inspectionSyncStatusEnum = pgEnum('inspection_sync_status', [
  'synced',
  'pending',
  'failed',
])

export const inspectionInitiationMethodEnum = pgEnum('inspection_initiation_method', [
  'nfc',
  'qr_code',
  'manual',
])

/**
 * Offline sync data structure for inspection records
 * Stores data captured offline that needs to be synced when connectivity is restored
 */
export interface InspectionOfflineData {
  /** Client-generated UUID for deduplication */
  clientId: string
  /** Timestamp when inspection was started offline */
  capturedAt: string
  /** Device info for debugging */
  deviceInfo?: {
    platform?: string
    model?: string
    osVersion?: string
  }
  /** Network status when captured */
  wasOffline: boolean
  /** Number of sync attempts */
  syncAttempts?: number
  /** Last sync error message */
  lastSyncError?: string
}

export const inspections = pgTable(
  'inspections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => inspectionTemplates.id, { onDelete: 'restrict' }),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operatorSessionId: uuid('operator_session_id').references(() => operatorSessions.id, {
      onDelete: 'set null',
    }),

    // Inspection timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // How the inspection was started
    initiationMethod: inspectionInitiationMethodEnum('initiation_method').notNull(),
    // NFC/QR payload data (stored for audit purposes)
    scanData: text('scan_data'),

    // GPS location at start
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    locationName: varchar('location_name', { length: 255 }),
    locationAccuracy: decimal('location_accuracy', { precision: 10, scale: 2 }),

    // Status tracking
    status: inspectionStatusEnum('status').default('in_progress').notNull(),
    syncStatus: inspectionSyncStatusEnum('sync_status').default('synced').notNull(),

    // Notes and summary
    notes: text('notes'),
    overallResult: varchar('overall_result', { length: 50 }),

    // Offline sync data
    offlineData: jsonb('offline_data').$type<InspectionOfflineData>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inspections_organisation_id_idx').on(table.organisationId),
    index('inspections_asset_id_idx').on(table.assetId),
    index('inspections_template_id_idx').on(table.templateId),
    index('inspections_operator_id_idx').on(table.operatorId),
    index('inspections_operator_session_id_idx').on(table.operatorSessionId),
    index('inspections_status_idx').on(table.status),
    index('inspections_sync_status_idx').on(table.syncStatus),
    index('inspections_started_at_idx').on(table.startedAt),
  ],
)

export type Inspection = typeof inspections.$inferSelect
export type NewInspection = typeof inspections.$inferInsert
