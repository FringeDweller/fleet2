import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const inventoryCountStatusEnum = pgEnum('inventory_count_status', [
  'in_progress',
  'completed',
  'cancelled',
])

export const inventoryCountSessions = pgTable(
  'inventory_count_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    status: inventoryCountStatusEnum('status').default('in_progress').notNull(),
    name: varchar('name', { length: 200 }),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    startedById: uuid('started_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    completedById: uuid('completed_by_id').references(() => users.id, { onDelete: 'restrict' }),
    cancelledById: uuid('cancelled_by_id').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inventory_count_sessions_organisation_id_idx').on(table.organisationId),
    index('inventory_count_sessions_status_idx').on(table.status),
    index('inventory_count_sessions_started_at_idx').on(table.startedAt),
  ],
)

export type InventoryCountSession = typeof inventoryCountSessions.$inferSelect
export type NewInventoryCountSession = typeof inventoryCountSessions.$inferInsert
