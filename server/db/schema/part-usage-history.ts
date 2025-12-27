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
import { parts } from './parts'
import { users } from './users'
import { workOrders } from './work-orders'

export const partUsageTypeEnum = pgEnum('part_usage_type', [
  'work_order',
  'adjustment',
  'restock',
  'return',
  'damaged',
  'expired',
])

export const partUsageHistory = pgTable(
  'part_usage_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    workOrderId: uuid('work_order_id').references(() => workOrders.id, { onDelete: 'set null' }),
    usageType: partUsageTypeEnum('usage_type').notNull(),
    quantityChange: decimal('quantity_change', { precision: 12, scale: 2 }).notNull(),
    previousQuantity: decimal('previous_quantity', { precision: 12, scale: 2 }).notNull(),
    newQuantity: decimal('new_quantity', { precision: 12, scale: 2 }).notNull(),
    unitCostAtTime: decimal('unit_cost_at_time', { precision: 12, scale: 2 }),
    notes: text('notes'),
    reference: varchar('reference', { length: 200 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('part_usage_history_part_id_idx').on(table.partId),
    index('part_usage_history_work_order_id_idx').on(table.workOrderId),
    index('part_usage_history_created_at_idx').on(table.createdAt),
  ],
)

export type PartUsageHistory = typeof partUsageHistory.$inferSelect
export type NewPartUsageHistory = typeof partUsageHistory.$inferInsert
