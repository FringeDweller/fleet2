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
  'defect_reported',
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
