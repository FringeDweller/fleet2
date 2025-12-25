import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { workOrders, workOrderStatusEnum } from './work-orders'
import { users } from './users'

export const workOrderStatusHistory = pgTable(
  'work_order_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    fromStatus: workOrderStatusEnum('from_status'),
    toStatus: workOrderStatusEnum('to_status').notNull(),
    changedById: uuid('changed_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('work_order_status_history_work_order_id_idx').on(table.workOrderId),
    index('work_order_status_history_created_at_idx').on(table.createdAt)
  ]
)

export type WorkOrderStatusHistory = typeof workOrderStatusHistory.$inferSelect
export type NewWorkOrderStatusHistory = typeof workOrderStatusHistory.$inferInsert
