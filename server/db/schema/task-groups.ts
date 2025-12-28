import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const taskGroups = pgTable(
  'task_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    parentId: uuid('parent_id').references((): any => taskGroups.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('task_groups_organisation_id_idx').on(table.organisationId),
    index('task_groups_parent_id_idx').on(table.parentId),
    index('task_groups_sort_order_idx').on(table.sortOrder),
  ],
)

export type TaskGroup = typeof taskGroups.$inferSelect
export type NewTaskGroup = typeof taskGroups.$inferInsert
