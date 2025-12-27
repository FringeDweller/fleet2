import {
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { parts } from './parts'
import { users } from './users'
import { workOrders } from './work-orders'

export const workOrderParts = pgTable(
  'work_order_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    // Optional link to parts inventory - when set, enables stock tracking and deduction
    partId: uuid('part_id').references(() => parts.id, { onDelete: 'set null' }),
    partName: varchar('part_name', { length: 200 }).notNull(),
    partNumber: varchar('part_number', { length: 100 }),
    quantity: integer('quantity').notNull().default(1),
    unitCost: decimal('unit_cost', { precision: 12, scale: 2 }),
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
    notes: text('notes'),
    addedById: uuid('added_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('work_order_parts_work_order_id_idx').on(table.workOrderId),
    index('work_order_parts_part_id_idx').on(table.partId),
  ],
)

export type WorkOrderPart = typeof workOrderParts.$inferSelect
export type NewWorkOrderPart = typeof workOrderParts.$inferInsert
