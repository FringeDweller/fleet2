import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { assetCategories } from './asset-categories'
import { assets } from './assets'
import { organisations } from './organisations'
import type { TemplateChecklistItem, TemplateRequiredPart } from './task-templates'
import { taskTemplates } from './task-templates'

export const taskOverrides = pgTable(
  'task_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    taskTemplateId: uuid('task_template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    // Either asset_id OR category_id must be set, but not both
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => assetCategories.id, { onDelete: 'cascade' }),
    // Override fields (null means "use template default")
    partsOverride: jsonb('parts_override').$type<TemplateRequiredPart[]>(),
    checklistOverride: jsonb('checklist_override').$type<TemplateChecklistItem[]>(),
    estimatedDurationOverride: integer('estimated_duration_override'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('task_overrides_organisation_id_idx').on(table.organisationId),
    index('task_overrides_task_template_id_idx').on(table.taskTemplateId),
    index('task_overrides_asset_id_idx').on(table.assetId),
    index('task_overrides_category_id_idx').on(table.categoryId),
  ],
)

export type TaskOverride = typeof taskOverrides.$inferSelect
export type NewTaskOverride = typeof taskOverrides.$inferInsert
