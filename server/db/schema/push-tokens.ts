import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const platformEnum = pgEnum('push_platform', ['ios', 'android', 'web'])

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceToken: varchar('device_token', { length: 500 }).notNull(),
    platform: platformEnum('platform').notNull(),
    deviceId: varchar('device_id', { length: 255 }),
    deviceInfo: text('device_info'), // JSON string with device model, OS version, etc.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('push_tokens_user_id_idx').on(table.userId),
    index('push_tokens_organisation_id_idx').on(table.organisationId),
    index('push_tokens_device_token_idx').on(table.deviceToken),
  ],
)

export type PushToken = typeof pushTokens.$inferSelect
export type NewPushToken = typeof pushTokens.$inferInsert
