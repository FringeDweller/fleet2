import { pgTable, uuid, varchar, text, timestamp, boolean, index, jsonb } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export interface CategoryMaintenanceTemplate {
  id: string
  name: string
  description?: string
  intervalDays?: number
  intervalHours?: number
  intervalMileage?: number
  estimatedDuration?: number
  checklistItems?: string[]
}

export interface DefaultPart {
  id: string
  partName: string
  partNumber?: string
  quantity: number
  estimatedCost?: number
  notes?: string
}

export const assetCategories = pgTable(
  'asset_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    defaultMaintenanceSchedules: jsonb('default_maintenance_schedules')
      .$type<CategoryMaintenanceTemplate[]>()
      .default([]),
    defaultParts: jsonb('default_parts').$type<DefaultPart[]>().default([]),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('asset_categories_organisation_id_idx').on(table.organisationId),
    index('asset_categories_parent_id_idx').on(table.parentId)
  ]
)

export type AssetCategory = typeof assetCategories.$inferSelect
export type NewAssetCategory = typeof assetCategories.$inferInsert
