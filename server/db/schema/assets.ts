import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  index,
  pgEnum
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { assetCategories } from './asset-categories'

export const assetStatusEnum = pgEnum('asset_status', [
  'active',
  'inactive',
  'maintenance',
  'disposed'
])

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => assetCategories.id, { onDelete: 'set null' }),
    assetNumber: varchar('asset_number', { length: 50 }).notNull(),
    vin: varchar('vin', { length: 17 }),
    make: varchar('make', { length: 100 }),
    model: varchar('model', { length: 100 }),
    year: integer('year'),
    licensePlate: varchar('license_plate', { length: 20 }),
    operationalHours: decimal('operational_hours', { precision: 12, scale: 2 }).default('0'),
    mileage: decimal('mileage', { precision: 12, scale: 2 }).default('0'),
    status: assetStatusEnum('status').default('active').notNull(),
    description: text('description'),
    imageUrl: varchar('image_url', { length: 500 }),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('assets_organisation_id_idx').on(table.organisationId),
    index('assets_category_id_idx').on(table.categoryId),
    index('assets_asset_number_idx').on(table.assetNumber),
    index('assets_status_idx').on(table.status),
    index('assets_is_archived_idx').on(table.isArchived)
  ]
)

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
