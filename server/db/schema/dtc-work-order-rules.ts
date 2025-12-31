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
import { users } from './users'

/**
 * DTC Work Order Rules Schema (US-10.7)
 *
 * Configurable rules to automatically create work orders when specific DTCs are detected.
 * Supports pattern matching (regex or exact code) with configurable priority and templates.
 */

export const dtcWorkOrderPriorityMappingEnum = pgEnum('dtc_wo_priority_mapping', [
  'use_severity', // Map DTC severity to WO priority
  'fixed', // Use fixed priority from rule
])

export const dtcWorkOrderRules = pgTable(
  'dtc_work_order_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Rule identification
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),

    // DTC matching pattern
    // Can be exact code (e.g., "P0300") or regex pattern (e.g., "P03.*" for all P03xx codes)
    dtcPattern: varchar('dtc_pattern', { length: 50 }).notNull(),
    // Whether pattern is regex (true) or exact match (false)
    isRegex: boolean('is_regex').default(false).notNull(),

    // Work order creation settings
    shouldCreateWorkOrder: boolean('should_create_work_order').default(true).notNull(),

    // Priority mapping
    priorityMapping: dtcWorkOrderPriorityMappingEnum('priority_mapping')
      .default('use_severity')
      .notNull(),
    // Fixed priority if priorityMapping = 'fixed'
    fixedPriority: varchar('fixed_priority', { length: 20 }).default('medium'),

    // Work order template (optional, for pre-populating checklist, etc.)
    workOrderTitle: varchar('work_order_title', { length: 200 }),
    workOrderDescription: text('work_order_description'),
    // Optional reference to a task template for checklists/parts
    templateId: uuid('template_id'),

    // Auto-assignment (optional)
    autoAssignToId: uuid('auto_assign_to_id').references(() => users.id, { onDelete: 'set null' }),

    // Rule state
    isActive: boolean('is_active').default(true).notNull(),

    // Audit fields
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dtc_wo_rules_organisation_id_idx').on(table.organisationId),
    index('dtc_wo_rules_is_active_idx').on(table.isActive),
    index('dtc_wo_rules_dtc_pattern_idx').on(table.dtcPattern),
  ],
)

export type DtcWorkOrderRule = typeof dtcWorkOrderRules.$inferSelect
export type NewDtcWorkOrderRule = typeof dtcWorkOrderRules.$inferInsert

/**
 * DTC Work Order History Schema
 *
 * Tracks which work orders were created from which DTCs to prevent duplicates.
 */
export const dtcWorkOrderHistory = pgTable(
  'dtc_work_order_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // DTC information
    dtcCode: varchar('dtc_code', { length: 20 }).notNull(),
    dtcDescription: text('dtc_description'),
    dtcSeverity: varchar('dtc_severity', { length: 20 }),

    // Asset where DTC was detected
    assetId: uuid('asset_id').notNull(),

    // Rule that triggered creation (optional if manual)
    ruleId: uuid('rule_id').references(() => dtcWorkOrderRules.id, { onDelete: 'set null' }),

    // Work order created
    workOrderId: uuid('work_order_id').notNull(),

    // Status tracking
    // 'active' = WO is still open, prevents duplicate creation
    // 'resolved' = WO completed, allows new WO if DTC reoccurs
    status: varchar('status', { length: 20 }).default('active').notNull(),

    // Timestamps
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dtc_wo_history_organisation_id_idx').on(table.organisationId),
    index('dtc_wo_history_asset_id_idx').on(table.assetId),
    index('dtc_wo_history_dtc_code_idx').on(table.dtcCode),
    index('dtc_wo_history_work_order_id_idx').on(table.workOrderId),
    // Composite index for duplicate prevention lookup
    index('dtc_wo_history_asset_dtc_status_idx').on(table.assetId, table.dtcCode, table.status),
  ],
)

export type DtcWorkOrderHistory = typeof dtcWorkOrderHistory.$inferSelect
export type NewDtcWorkOrderHistory = typeof dtcWorkOrderHistory.$inferInsert
