import {
  boolean,
  decimal,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { geofences } from './geofences'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Geofence Alert Types
 * - entry: Vehicle entered a geofence boundary
 * - exit: Vehicle exited a geofence boundary
 * - after_hours_movement: Vehicle moved during after-hours period
 */
export const geofenceAlertTypeEnum = pgEnum('geofence_alert_type', [
  'entry',
  'exit',
  'after_hours_movement',
])

/**
 * Geofence Alert Settings - Configure alerts for each geofence
 *
 * Defines what types of alerts to trigger for a specific geofence
 * and who should be notified.
 *
 * @requirement US-12.5
 */
export const geofenceAlertSettings = pgTable(
  'geofence_alert_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    geofenceId: uuid('geofence_id')
      .notNull()
      .references(() => geofences.id, { onDelete: 'cascade' }),
    // Alert triggers
    alertOnEntry: boolean('alert_on_entry').default(true).notNull(),
    alertOnExit: boolean('alert_on_exit').default(true).notNull(),
    alertAfterHours: boolean('alert_after_hours').default(false).notNull(),
    // Notification channels
    notifyByPush: boolean('notify_by_push').default(true).notNull(),
    notifyByEmail: boolean('notify_by_email').default(false).notNull(),
    // Users to notify (null = all admins and fleet managers)
    notifyUserIds: jsonb('notify_user_ids').$type<string[]>(),
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('geofence_alert_settings_organisation_id_idx').on(table.organisationId),
    index('geofence_alert_settings_geofence_id_idx').on(table.geofenceId),
  ],
)

/**
 * Geofence Alerts - Log of all geofence alerts triggered
 *
 * Records every instance of a vehicle triggering a geofence alert,
 * with location, timestamp, and acknowledgement tracking.
 *
 * @requirement US-12.5
 */
export const geofenceAlerts = pgTable(
  'geofence_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    geofenceId: uuid('geofence_id')
      .notNull()
      .references(() => geofences.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Optional link to operator session if vehicle is being operated
    operatorSessionId: uuid('operator_session_id').references(() => operatorSessions.id, {
      onDelete: 'set null',
    }),
    // Type of alert triggered
    alertType: geofenceAlertTypeEnum('alert_type').notNull(),
    // Location where the alert was triggered
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    // When the alert was triggered
    alertedAt: timestamp('alerted_at', { withTimezone: true }).notNull(),
    // Acknowledgement tracking
    isAcknowledged: boolean('is_acknowledged').default(false).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedById: uuid('acknowledged_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Audit field
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('geofence_alerts_organisation_id_idx').on(table.organisationId),
    index('geofence_alerts_geofence_id_idx').on(table.geofenceId),
    index('geofence_alerts_asset_id_idx').on(table.assetId),
    index('geofence_alerts_alerted_at_idx').on(table.alertedAt),
    // Index for finding unacknowledged alerts
    index('geofence_alerts_is_acknowledged_idx').on(table.isAcknowledged),
    // Composite index for common query pattern
    index('geofence_alerts_org_acknowledged_alerted_idx').on(
      table.organisationId,
      table.isAcknowledged,
      table.alertedAt,
    ),
  ],
)

export type GeofenceAlertSettings = typeof geofenceAlertSettings.$inferSelect
export type NewGeofenceAlertSettings = typeof geofenceAlertSettings.$inferInsert

export type GeofenceAlert = typeof geofenceAlerts.$inferSelect
export type NewGeofenceAlert = typeof geofenceAlerts.$inferInsert
