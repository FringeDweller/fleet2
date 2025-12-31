import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { organisations } from './organisations'
import { users } from './users'
import { workOrders } from './work-orders'

// DTC severity classification
export const dtcSeverityEnum = pgEnum('dtc_severity', ['info', 'warning', 'critical'])

// DTC code type (P=Powertrain, C=Chassis, B=Body, U=Network)
export const dtcCodeTypeEnum = pgEnum('dtc_code_type', ['P', 'C', 'B', 'U'])

export const diagnosticCodes = pgTable(
  'diagnostic_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // DTC code details
    code: varchar('code', { length: 10 }).notNull(), // e.g., P0301, C0035
    codeType: dtcCodeTypeEnum('code_type').notNull(), // P, C, B, or U
    description: text('description'), // Human-readable description
    severity: dtcSeverityEnum('severity').notNull().default('warning'),
    // Additional diagnostic data from OBD-II
    rawResponse: text('raw_response'), // Raw OBD-II response for debugging
    freeze_frame_data: text('freeze_frame_data'), // JSON of freeze frame data if available
    // When the code was first read
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
    readByUserId: uuid('read_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    // Clearing information (null if still active)
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    clearedByUserId: uuid('cleared_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Work order reference required for clearing
    workOrderId: uuid('work_order_id').references(() => workOrders.id, { onDelete: 'set null' }),
    // Sync status for offline support
    syncStatus: varchar('sync_status', { length: 20 }).default('synced').notNull(), // 'synced' | 'pending' | 'failed'
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('diagnostic_codes_organisation_id_idx').on(table.organisationId),
    index('diagnostic_codes_asset_id_idx').on(table.assetId),
    index('diagnostic_codes_code_idx').on(table.code),
    index('diagnostic_codes_severity_idx').on(table.severity),
    index('diagnostic_codes_read_at_idx').on(table.readAt),
    index('diagnostic_codes_cleared_at_idx').on(table.clearedAt),
    index('diagnostic_codes_work_order_id_idx').on(table.workOrderId),
  ],
)

export type DiagnosticCode = typeof diagnosticCodes.$inferSelect
export type NewDiagnosticCode = typeof diagnosticCodes.$inferInsert
