import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { organisations } from './organisations'
import { users } from './users'

export const operatorSessionStatusEnum = pgEnum('operator_session_status', [
  'active',
  'completed',
  'cancelled',
])

export const operatorSessionSyncStatusEnum = pgEnum('operator_session_sync_status', [
  'synced',
  'pending',
  'failed',
])

export const operatorSessions = pgTable(
  'operator_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Session timing
    startTime: timestamp('start_time', { withTimezone: true }).notNull().defaultNow(),
    endTime: timestamp('end_time', { withTimezone: true }),

    // Odometer/hours readings
    startOdometer: decimal('start_odometer', { precision: 12, scale: 2 }),
    endOdometer: decimal('end_odometer', { precision: 12, scale: 2 }),
    startHours: decimal('start_hours', { precision: 12, scale: 2 }),
    endHours: decimal('end_hours', { precision: 12, scale: 2 }),

    // Location tracking
    startLatitude: decimal('start_latitude', { precision: 10, scale: 7 }),
    startLongitude: decimal('start_longitude', { precision: 10, scale: 7 }),
    startLocationName: text('start_location_name'),
    endLatitude: decimal('end_latitude', { precision: 10, scale: 7 }),
    endLongitude: decimal('end_longitude', { precision: 10, scale: 7 }),
    endLocationName: text('end_location_name'),

    // Calculated trip metrics (computed on log-off)
    tripDistance: decimal('trip_distance', { precision: 12, scale: 2 }),
    tripDurationMinutes: integer('trip_duration_minutes'),

    // Session status
    status: operatorSessionStatusEnum('status').default('active').notNull(),
    syncStatus: operatorSessionSyncStatusEnum('sync_status').default('synced').notNull(),

    // Notes and additional data
    notes: text('notes'),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('operator_sessions_organisation_id_idx').on(table.organisationId),
    index('operator_sessions_asset_id_idx').on(table.assetId),
    index('operator_sessions_operator_id_idx').on(table.operatorId),
    index('operator_sessions_status_idx').on(table.status),
    index('operator_sessions_start_time_idx').on(table.startTime),
    // Index for finding active sessions
    index('operator_sessions_active_asset_idx').on(table.assetId, table.status),
    index('operator_sessions_active_operator_idx').on(table.operatorId, table.status),
  ],
)

export type OperatorSession = typeof operatorSessions.$inferSelect
export type NewOperatorSession = typeof operatorSessions.$inferInsert
