import { boolean, decimal, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Fuel Alert Settings (US-11.5)
 *
 * Organization-level configuration for fuel anomaly detection thresholds.
 * Controls when alerts are triggered for high/low consumption and refuel without distance.
 */
export const fuelAlertSettings = pgTable(
  'fuel_alert_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' })
      .unique(), // One settings record per organisation

    // High consumption threshold (percentage above average)
    // e.g., 30 means alert if consumption is 30% above asset's average
    highConsumptionThreshold: decimal('high_consumption_threshold', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('30.00'),

    // Low consumption threshold (percentage below average)
    // e.g., 30 means alert if consumption is 30% below asset's average
    lowConsumptionThreshold: decimal('low_consumption_threshold', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('30.00'),

    // Critical threshold - escalates from warning to critical
    criticalThreshold: decimal('critical_threshold', { precision: 5, scale: 2 })
      .notNull()
      .default('50.00'),

    // Minimum distance (km) between refuels to not trigger "refuel without distance" alert
    // e.g., 10 means alert if distance traveled is less than 10km since last refuel
    minDistanceBetweenRefuels: decimal('min_distance_between_refuels', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('10.00'),

    // Enable/disable flags
    enableHighConsumptionAlerts: boolean('enable_high_consumption_alerts').notNull().default(true),
    enableLowConsumptionAlerts: boolean('enable_low_consumption_alerts').notNull().default(true),
    enableRefuelWithoutDistanceAlerts: boolean('enable_refuel_without_distance_alerts')
      .notNull()
      .default(true),
    enableMissingOdometerAlerts: boolean('enable_missing_odometer_alerts').notNull().default(true),

    // Notification settings
    sendEmailNotifications: boolean('send_email_notifications').notNull().default(false),
    sendInAppNotifications: boolean('send_in_app_notifications').notNull().default(true),

    // Optional notes/description
    notes: text('notes'),

    // Audit fields
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('fuel_alert_settings_organisation_id_idx').on(table.organisationId)],
)

export type FuelAlertSettings = typeof fuelAlertSettings.$inferSelect
export type NewFuelAlertSettings = typeof fuelAlertSettings.$inferInsert
