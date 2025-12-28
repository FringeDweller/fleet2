import {
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { parts } from './parts'
import { storageLocations } from './storage-locations'
import { users } from './users'

export const inventoryTransfers = pgTable(
  'inventory_transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'restrict' }),
    fromLocationId: uuid('from_location_id')
      .notNull()
      .references(() => storageLocations.id, { onDelete: 'restrict' }),
    toLocationId: uuid('to_location_id')
      .notNull()
      .references(() => storageLocations.id, { onDelete: 'restrict' }),
    quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
    transferredById: uuid('transferred_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    notes: text('notes'),
    // Optional reference number for tracking
    referenceNumber: varchar('reference_number', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inventory_transfers_organisation_id_idx').on(table.organisationId),
    index('inventory_transfers_part_id_idx').on(table.partId),
    index('inventory_transfers_from_location_id_idx').on(table.fromLocationId),
    index('inventory_transfers_to_location_id_idx').on(table.toLocationId),
    index('inventory_transfers_transferred_by_id_idx').on(table.transferredById),
    index('inventory_transfers_created_at_idx').on(table.createdAt),
  ],
)

export type InventoryTransfer = typeof inventoryTransfers.$inferSelect
export type NewInventoryTransfer = typeof inventoryTransfers.$inferInsert
