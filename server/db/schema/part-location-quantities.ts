import { decimal, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { parts } from './parts'
import { storageLocations } from './storage-locations'

export const partLocationQuantities = pgTable(
  'part_location_quantities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => storageLocations.id, { onDelete: 'cascade' }),
    quantity: decimal('quantity', { precision: 12, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('part_location_quantities_organisation_id_idx').on(table.organisationId),
    index('part_location_quantities_part_id_idx').on(table.partId),
    index('part_location_quantities_location_id_idx').on(table.locationId),
    // Unique constraint: one quantity record per part-location combination
    unique('part_location_quantities_part_location_unique').on(table.partId, table.locationId),
  ],
)

export type PartLocationQuantity = typeof partLocationQuantities.$inferSelect
export type NewPartLocationQuantity = typeof partLocationQuantities.$inferInsert
