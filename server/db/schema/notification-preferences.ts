import { boolean, jsonb, pgTable, time, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

/**
 * User notification preferences (US-16.4)
 *
 * Allows users to configure their notification preferences per event type,
 * choose delivery channels (in-app, push, email), and set quiet hours.
 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organisationId: uuid('organisation_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),

  // Global channel preferences
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),

  // Per-category notification preferences
  // Work order notifications
  workOrderAssigned: boolean('work_order_assigned').default(true).notNull(),
  workOrderStatusChanged: boolean('work_order_status_changed').default(true).notNull(),
  workOrderApprovalRequested: boolean('work_order_approval_requested').default(true).notNull(),
  workOrderApproved: boolean('work_order_approved').default(true).notNull(),
  workOrderRejected: boolean('work_order_rejected').default(true).notNull(),
  workOrderDueSoon: boolean('work_order_due_soon').default(true).notNull(),
  workOrderOverdue: boolean('work_order_overdue').default(true).notNull(),

  // Asset and monitoring notifications
  geofenceAlerts: boolean('geofence_alerts').default(true).notNull(),
  fuelAnomalies: boolean('fuel_anomalies').default(true).notNull(),
  documentExpiring: boolean('document_expiring').default(true).notNull(),
  defectReported: boolean('defect_reported').default(true).notNull(),

  // Shift and operator notifications
  shiftHandover: boolean('shift_handover').default(true).notNull(),

  // System notifications
  systemNotifications: boolean('system_notifications').default(true).notNull(),

  // Quiet hours settings
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false).notNull(),
  quietHoursStart: time('quiet_hours_start'), // e.g., "22:00:00"
  quietHoursEnd: time('quiet_hours_end'), // e.g., "07:00:00"
  quietHoursDays: jsonb('quiet_hours_days').$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]), // 0=Sunday, 6=Saturday

  // Email digest preferences
  emailDigestEnabled: boolean('email_digest_enabled').default(false).notNull(),
  emailDigestFrequency: varchar('email_digest_frequency', { length: 20 }).default('daily'), // 'daily' | 'weekly' | 'never'

  // Channel preference overrides per category (JSON object)
  // Format: { categoryName: { email: boolean, push: boolean, inApp: boolean } }
  channelOverrides:
    jsonb('channel_overrides').$type<
      Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>
    >(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Note: Relations are defined in relations.ts

// Types
export type NotificationPreferences = typeof notificationPreferences.$inferSelect
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert

// Default preferences for new users
export const defaultNotificationPreferences: Omit<
  NewNotificationPreferences,
  'id' | 'userId' | 'organisationId' | 'createdAt' | 'updatedAt'
> = {
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  workOrderAssigned: true,
  workOrderStatusChanged: true,
  workOrderApprovalRequested: true,
  workOrderApproved: true,
  workOrderRejected: true,
  workOrderDueSoon: true,
  workOrderOverdue: true,
  geofenceAlerts: true,
  fuelAnomalies: true,
  documentExpiring: true,
  defectReported: true,
  shiftHandover: true,
  systemNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursDays: [0, 1, 2, 3, 4, 5, 6],
  emailDigestEnabled: false,
  emailDigestFrequency: 'daily',
  channelOverrides: null,
}
