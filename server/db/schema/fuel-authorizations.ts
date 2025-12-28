import {
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { fuelTransactions } from './fuel-transactions'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'
import { users } from './users'

export const fuelAuthStatusEnum = pgEnum('fuel_auth_status', [
  'pending',
  'authorized',
  'completed',
  'cancelled',
  'expired',
])

export const fuelAuthorizations = pgTable(
  'fuel_authorizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    operatorSessionId: uuid('operator_session_id')
      .notNull()
      .references(() => operatorSessions.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Auth code for bowser validation (short alphanumeric, e.g., "A7X3K9")
    authCode: varchar('auth_code', { length: 10 }).notNull().unique(),

    // QR code data (encoded JSON with auth details)
    qrCodeData: text('qr_code_data').notNull(),

    // Authorization status
    status: fuelAuthStatusEnum('status').default('pending').notNull(),

    // Pre-auth limits (optional)
    maxQuantityLitres: decimal('max_quantity_litres', { precision: 10, scale: 2 }),
    maxAmountDollars: decimal('max_amount_dollars', { precision: 10, scale: 2 }),

    // Linked transaction when completed
    fuelTransactionId: uuid('fuel_transaction_id').references(() => fuelTransactions.id, {
      onDelete: 'set null',
    }),

    // Timestamps
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // Typically 15-30 min
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('fuel_authorizations_organisation_id_idx').on(table.organisationId),
    index('fuel_authorizations_asset_id_idx').on(table.assetId),
    index('fuel_authorizations_operator_id_idx').on(table.operatorId),
    index('fuel_authorizations_operator_session_id_idx').on(table.operatorSessionId),
    index('fuel_authorizations_auth_code_idx').on(table.authCode),
    index('fuel_authorizations_status_idx').on(table.status),
    index('fuel_authorizations_expires_at_idx').on(table.expiresAt),
    // Index for finding pending/authorized authorizations by auth code
    index('fuel_authorizations_pending_code_idx').on(table.authCode, table.status),
  ],
)

export type FuelAuthorization = typeof fuelAuthorizations.$inferSelect
export type NewFuelAuthorization = typeof fuelAuthorizations.$inferInsert
