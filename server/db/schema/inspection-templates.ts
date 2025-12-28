import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assetCategories } from './asset-categories'
import { organisations } from './organisations'

/**
 * Checklist item structure for inspection templates
 */
export interface InspectionChecklistItem {
  id: string
  label: string
  description?: string
  type: 'pass_fail' | 'numeric' | 'text' | 'photo' | 'signature'
  required: boolean
  order: number
  category?: string
  // For numeric type
  minValue?: number
  maxValue?: number
  unit?: string
}

export const inspectionTemplates = pgTable(
  'inspection_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => assetCategories.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    checklistItems: jsonb('checklist_items').$type<InspectionChecklistItem[]>().default([]),
    isActive: boolean('is_active').default(true).notNull(),
    // Offline sync support
    version: uuid('version').defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inspection_templates_organisation_id_idx').on(table.organisationId),
    index('inspection_templates_category_id_idx').on(table.categoryId),
    index('inspection_templates_is_active_idx').on(table.isActive),
  ],
)

export type InspectionTemplate = typeof inspectionTemplates.$inferSelect
export type NewInspectionTemplate = typeof inspectionTemplates.$inferInsert
