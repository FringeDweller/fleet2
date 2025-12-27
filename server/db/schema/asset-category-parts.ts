import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { assetCategories } from './asset-categories'
import { parts } from './parts'

export const assetCategoryParts = pgTable(
  'asset_category_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => assetCategories.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_category_parts_category_id_idx').on(table.categoryId),
    index('asset_category_parts_part_id_idx').on(table.partId),
  ],
)

export type AssetCategoryPart = typeof assetCategoryParts.$inferSelect
export type NewAssetCategoryPart = typeof assetCategoryParts.$inferInsert
