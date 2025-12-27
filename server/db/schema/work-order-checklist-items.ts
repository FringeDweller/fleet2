import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index
} from 'drizzle-orm/pg-core'
import { workOrders } from './work-orders'
import { users } from './users'

export const workOrderChecklistItems = pgTable(
  'work_order_checklist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    templateItemId: varchar('template_item_id', { length: 36 }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    isRequired: boolean('is_required').default(false).notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedById: uuid('completed_by_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('work_order_checklist_items_work_order_id_idx').on(table.workOrderId),
    index('work_order_checklist_items_order_idx').on(table.order)
  ]
)

export type WorkOrderChecklistItem = typeof workOrderChecklistItems.$inferSelect
export type NewWorkOrderChecklistItem = typeof workOrderChecklistItems.$inferInsert
