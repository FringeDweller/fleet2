/**
 * US-9.6: Vehicle Operation Blocking
 * Tracks when vehicles are blocked from operation due to defects
 * and records supervisor override actions
 */
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { defects } from './defects'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Operation blocks are automatically created when blocking defects are detected.
 * Each block record represents a period during which the vehicle cannot operate.
 */
export const operationBlocks = pgTable(
  'operation_blocks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // The defect that caused this block
    defectId: uuid('defect_id')
      .notNull()
      .references(() => defects.id, { onDelete: 'cascade' }),
    // The severity that triggered the block
    blockingSeverity: varchar('blocking_severity', { length: 20 }).notNull(),
    // Block is active until defect is resolved or supervisor overrides
    isActive: boolean('is_active').default(true).notNull(),
    // Block started when defect was created
    blockedAt: timestamp('blocked_at', { withTimezone: true }).defaultNow().notNull(),
    // If resolved through defect fix
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    // Override by supervisor
    overriddenAt: timestamp('overridden_at', { withTimezone: true }),
    overriddenById: uuid('overridden_by_id').references(() => users.id, { onDelete: 'set null' }),
    overrideReason: text('override_reason'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('operation_blocks_organisation_id_idx').on(table.organisationId),
    index('operation_blocks_asset_id_idx').on(table.assetId),
    index('operation_blocks_defect_id_idx').on(table.defectId),
    index('operation_blocks_is_active_idx').on(table.isActive),
    index('operation_blocks_blocked_at_idx').on(table.blockedAt),
  ],
)

export type OperationBlock = typeof operationBlocks.$inferSelect
export type NewOperationBlock = typeof operationBlocks.$inferInsert
