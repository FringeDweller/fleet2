import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export interface TemplateChecklistItem {
  id: string
  title: string
  description?: string
  isRequired: boolean
  order: number
}

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    estimatedDuration: integer('estimated_duration'),
    checklistItems: jsonb('checklist_items').$type<TemplateChecklistItem[]>().default([]).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('task_templates_organisation_id_idx').on(table.organisationId),
    index('task_templates_is_archived_idx').on(table.isArchived)
  ]
)

export type TaskTemplate = typeof taskTemplates.$inferSelect
export type NewTaskTemplate = typeof taskTemplates.$inferInsert
