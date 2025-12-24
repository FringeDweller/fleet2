import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

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
