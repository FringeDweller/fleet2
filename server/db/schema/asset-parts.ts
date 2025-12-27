import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { parts } from './parts'

export const assetParts = pgTable(
  'asset_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_parts_asset_id_idx').on(table.assetId),
    index('asset_parts_part_id_idx').on(table.partId),
  ],
)

export type AssetPart = typeof assetParts.$inferSelect
export type NewAssetPart = typeof assetParts.$inferInsert
