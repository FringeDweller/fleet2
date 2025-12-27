import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  pgEnum,
  numeric
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export interface TemplateChecklistItem {
  id: string
  title: string
  description?: string
  isRequired: boolean
  order: number
}

export interface TemplateRequiredPart {
  id: string
  partName: string
  partNumber?: string
  quantity: number
  estimatedCost?: number
  notes?: string
}

export const skillLevelEnum = pgEnum('skill_level', ['entry', 'intermediate', 'advanced', 'expert'])

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }),
    estimatedDuration: integer('estimated_duration'),
    estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
    skillLevel: skillLevelEnum('skill_level').default('entry'),
    checklistItems: jsonb('checklist_items').$type<TemplateChecklistItem[]>().default([]).notNull(),
    requiredParts: jsonb('required_parts').$type<TemplateRequiredPart[]>().default([]).notNull(),
    version: integer('version').default(1).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('task_templates_organisation_id_idx').on(table.organisationId),
    index('task_templates_is_archived_idx').on(table.isArchived),
    index('task_templates_category_idx').on(table.category)
  ]
)

export type TaskTemplate = typeof taskTemplates.$inferSelect
export type NewTaskTemplate = typeof taskTemplates.$inferInsert
