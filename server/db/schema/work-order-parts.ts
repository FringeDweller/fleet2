import { pgTable, uuid, varchar, text, timestamp, integer, decimal, index } from 'drizzle-orm/pg-core'
import { workOrders } from './work-orders'
import { users } from './users'

export const workOrderParts = pgTable(
  'work_order_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('work_order_parts_work_order_id_idx').on(table.workOrderId)
  ]
)

export type WorkOrderPart = typeof workOrderParts.$inferSelect
export type NewWorkOrderPart = typeof workOrderParts.$inferInsert
