import { decimal, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { parts } from './parts'
import { taskTemplates } from './task-templates'

export const taskTemplateParts = pgTable(
  'task_template_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    quantity: decimal('quantity', { precision: 12, scale: 2 }).default('1').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('task_template_parts_template_id_idx').on(table.templateId),
    index('task_template_parts_part_id_idx').on(table.partId),
  ],
)

export type TaskTemplatePart = typeof taskTemplateParts.$inferSelect
export type NewTaskTemplatePart = typeof taskTemplateParts.$inferInsert
