import {
  decimal,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { inspections } from './inspections'

export const inspectionItemResultEnum = pgEnum('inspection_item_result', [
  'pass',
  'fail',
  'na',
  'pending',
])

/**
 * Photo attachment for inspection items
 */
export interface InspectionItemPhoto {
  id: string
  url: string
  caption?: string
  takenAt: string
}

export const inspectionItems = pgTable(
  'inspection_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id, { onDelete: 'cascade' }),

    // Link to template item
    checklistItemId: varchar('checklist_item_id', { length: 100 }).notNull(),
    checklistItemLabel: varchar('checklist_item_label', { length: 255 }).notNull(),
    checklistItemType: varchar('checklist_item_type', { length: 50 }).notNull(),

    // Response data
    result: inspectionItemResultEnum('result').default('pending').notNull(),
    numericValue: decimal('numeric_value', { precision: 12, scale: 4 }),
    textValue: text('text_value'),
    photos: jsonb('photos').$type<InspectionItemPhoto[]>().default([]),
    signature: text('signature'), // Base64 encoded signature image

    // Notes for failures or observations
    notes: text('notes'),

    // Timestamp when this item was responded
    respondedAt: timestamp('responded_at', { withTimezone: true }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inspection_items_inspection_id_idx').on(table.inspectionId),
    index('inspection_items_result_idx').on(table.result),
    index('inspection_items_checklist_item_id_idx').on(table.checklistItemId),
  ],
)

export type InspectionItem = typeof inspectionItems.$inferSelect
export type NewInspectionItem = typeof inspectionItems.$inferInsert
