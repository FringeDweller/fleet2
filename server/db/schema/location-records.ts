import { decimal, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'

/**
 * Location Records - GPS tracking data captured during operator sessions
 *
 * Records are captured at configurable intervals (1-60 minutes) when an operator
 * is logged on to an asset. Records are stored locally on the device and synced
 * to the server when online.
 *
 * @requirement REQ-1201
 */
export const locationRecords = pgTable(
  'location_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Must have an active operator session (REQ-1201-AC-05)
    operatorSessionId: uuid('operator_session_id')
      .notNull()
      .references(() => operatorSessions.id, { onDelete: 'cascade' }),
    // GPS coordinates
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    // GPS accuracy in meters
    accuracy: decimal('accuracy', { precision: 10, scale: 2 }),
    // Altitude in meters (optional, may not be available on all devices)
    altitude: decimal('altitude', { precision: 10, scale: 2 }),
    // Speed in km/h (optional)
    speed: decimal('speed', { precision: 8, scale: 2 }),
    // Heading in degrees (0-360, optional)
    heading: decimal('heading', { precision: 6, scale: 2 }),
    // When the GPS reading was taken on the device
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    // When the record was synced to the server (null if pending sync)
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    // Standard audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Primary query index: find locations for an asset within a time range
    index('location_records_asset_id_recorded_at_idx').on(table.assetId, table.recordedAt),
    // Query by operator session for route tracking
    index('location_records_operator_session_id_idx').on(table.operatorSessionId),
    // Query by organisation and time for fleet-wide views
    index('location_records_organisation_id_recorded_at_idx').on(
      table.organisationId,
      table.recordedAt,
    ),
    // Index for finding unsynced records (cleanup/admin)
    index('location_records_synced_at_idx').on(table.syncedAt),
  ],
)

export type LocationRecord = typeof locationRecords.$inferSelect
export type NewLocationRecord = typeof locationRecords.$inferInsert
