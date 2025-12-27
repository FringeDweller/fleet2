import { decimal, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { users } from './users'

export const assetLocationHistory = pgTable(
  'asset_location_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    locationName: varchar('location_name', { length: 255 }),
    locationAddress: text('location_address'),
    // Who updated the location
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    // Optional notes about this location update
    notes: text('notes'),
    // Source of update (manual, gps, api, etc.)
    source: varchar('source', { length: 50 }).default('manual'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_location_history_asset_id_idx').on(table.assetId),
    index('asset_location_history_recorded_at_idx').on(table.recordedAt),
  ],
)

export type AssetLocationHistory = typeof assetLocationHistory.$inferSelect
export type NewAssetLocationHistory = typeof assetLocationHistory.$inferInsert
