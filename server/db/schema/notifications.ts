import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const notificationTypeEnum = pgEnum('notification_type', [
  'work_order_assigned',
  'work_order_unassigned',
  'work_order_status_changed',
  'work_order_due_soon',
  'work_order_overdue',
  'work_order_approval_requested',
  'work_order_approved',
  'work_order_rejected',
  'defect_reported',
  'geofence_entry',
  'geofence_exit',
  'after_hours_movement',
  'shift_handover', // US-8.5: Shift handover notifications for supervisors
  'fuel_anomaly', // US-11.5: Fuel consumption anomaly alerts
  'document_expiring', // US-15.6: Document expiry alerts
  'system',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    link: varchar('link', { length: 500 }),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_id_is_read_idx').on(table.userId, table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
