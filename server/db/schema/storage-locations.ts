import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const locationTypeEnum = pgEnum('location_type', [
  'warehouse',
  'bin',
  'shelf',
  'truck',
  'building',
  'room',
  'other',
])

export const storageLocations = pgTable(
  'storage_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    type: locationTypeEnum('type').default('warehouse').notNull(),
    // Optional parent for hierarchical locations (e.g., warehouse > bin)
    parentId: uuid('parent_id').references((): any => storageLocations.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 50 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('storage_locations_organisation_id_idx').on(table.organisationId),
    index('storage_locations_parent_id_idx').on(table.parentId),
    index('storage_locations_code_idx').on(table.code),
  ],
)

export type StorageLocation = typeof storageLocations.$inferSelect
export type NewStorageLocation = typeof storageLocations.$inferInsert
