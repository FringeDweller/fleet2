import {
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { inventoryCountSessions } from './inventory-count-sessions'
import { parts } from './parts'
import { users } from './users'

export const inventoryCountItemStatusEnum = pgEnum('inventory_count_item_status', [
  'pending',
  'counted',
  'approved',
  'rejected',
])

export const inventoryCountItems = pgTable(
  'inventory_count_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => inventoryCountSessions.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'restrict' }),
    location: varchar('location', { length: 100 }),
    systemQuantity: decimal('system_quantity', { precision: 12, scale: 2 }).notNull(),
    countedQuantity: decimal('counted_quantity', { precision: 12, scale: 2 }),
    discrepancy: decimal('discrepancy', { precision: 12, scale: 2 }),
    status: inventoryCountItemStatusEnum('status').default('pending').notNull(),
    countedAt: timestamp('counted_at', { withTimezone: true }),
    adjustedAt: timestamp('adjusted_at', { withTimezone: true }),
    adjustedById: uuid('adjusted_by_id').references(() => users.id, { onDelete: 'restrict' }),
    adjustmentReason: text('adjustment_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inventory_count_items_session_id_idx').on(table.sessionId),
    index('inventory_count_items_part_id_idx').on(table.partId),
    index('inventory_count_items_status_idx').on(table.status),
  ],
)

export type InventoryCountItem = typeof inventoryCountItems.$inferSelect
export type NewInventoryCountItem = typeof inventoryCountItems.$inferInsert
