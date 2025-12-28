import {
  boolean,
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
import { assets } from './assets'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'
import { users } from './users'

export const fuelTypeEnum = pgEnum('fuel_type', ['diesel', 'petrol', 'electric', 'lpg', 'other'])

export const fuelSyncStatusEnum = pgEnum('fuel_sync_status', ['synced', 'pending'])

export const fuelSourceEnum = pgEnum('fuel_source', [
  'manual', // Manually entered in the app
  'authorization', // Created from fuel authorization flow
  'external_sync', // Synced from external fuel backend
])

export const discrepancyTypeEnum = pgEnum('discrepancy_type', [
  'quantity_mismatch', // Dispensed quantity differs from authorized
  'amount_mismatch', // Cost differs significantly
  'asset_mismatch', // Transaction for different asset
  'unauthorized', // No matching authorization found
  'timing_mismatch', // Transaction outside authorization window
  'multiple', // Multiple discrepancy types
])

export const fuelTransactions = pgTable(
  'fuel_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Link to operator session if active (nullable - may not have an active session)
    operatorSessionId: uuid('operator_session_id').references(() => operatorSessions.id, {
      onDelete: 'set null',
    }),
    // Who recorded the transaction
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    // Fuel details
    quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(), // Litres
    unitCost: decimal('unit_cost', { precision: 10, scale: 4 }), // Cost per litre
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }), // Total cost
    fuelType: fuelTypeEnum('fuel_type').notNull().default('diesel'),
    // Reading at time of fueling
    odometer: decimal('odometer', { precision: 12, scale: 2 }), // km or miles
    engineHours: decimal('engine_hours', { precision: 12, scale: 2 }), // hours
    // Receipt and documentation
    receiptPhotoPath: varchar('receipt_photo_path', { length: 500 }),
    // Location where fueling occurred
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    locationName: varchar('location_name', { length: 255 }),
    locationAddress: text('location_address'),
    // Additional details
    vendor: varchar('vendor', { length: 255 }),
    notes: text('notes'),
    // Offline sync tracking
    syncStatus: fuelSyncStatusEnum('sync_status').notNull().default('synced'),
    // Transaction date (may differ from createdAt if entered retroactively)
    transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),

    // Source tracking for integration
    source: fuelSourceEnum('source').notNull().default('manual'),
    // External system reference for synced transactions
    externalTransactionId: varchar('external_transaction_id', { length: 255 }),
    externalSystemId: varchar('external_system_id', { length: 100 }),

    // Link to authorization if created from auth flow
    // Note: Foreign key defined in relations.ts to avoid circular import
    authorizationId: uuid('authorization_id'),

    // Discrepancy tracking
    hasDiscrepancy: boolean('has_discrepancy').notNull().default(false),
    discrepancyType: discrepancyTypeEnum('discrepancy_type'),
    discrepancyDetails: jsonb('discrepancy_details').$type<{
      authorizedQuantity?: number
      actualQuantity?: number
      authorizedAmount?: number
      actualAmount?: number
      authorizedAssetId?: string
      actualAssetId?: string
      quantityVariancePercent?: number
      amountVariancePercent?: number
      notes?: string
    }>(),
    discrepancyResolvedAt: timestamp('discrepancy_resolved_at', { withTimezone: true }),
    discrepancyResolvedById: uuid('discrepancy_resolved_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    discrepancyResolutionNotes: text('discrepancy_resolution_notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('fuel_transactions_organisation_id_idx').on(table.organisationId),
    index('fuel_transactions_asset_id_idx').on(table.assetId),
    index('fuel_transactions_user_id_idx').on(table.userId),
    index('fuel_transactions_transaction_date_idx').on(table.transactionDate),
    index('fuel_transactions_fuel_type_idx').on(table.fuelType),
    index('fuel_transactions_sync_status_idx').on(table.syncStatus),
    index('fuel_transactions_source_idx').on(table.source),
    index('fuel_transactions_external_id_idx').on(table.externalTransactionId),
    index('fuel_transactions_has_discrepancy_idx').on(table.hasDiscrepancy),
    index('fuel_transactions_authorization_id_idx').on(table.authorizationId),
  ],
)

export type FuelTransaction = typeof fuelTransactions.$inferSelect
export type NewFuelTransaction = typeof fuelTransactions.$inferInsert
