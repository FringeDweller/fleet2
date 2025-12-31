import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const exportEntityEnum = pgEnum('export_entity', [
  'assets',
  'work_orders',
  'parts',
  'inspections',
  'fuel_transactions',
])

export const exportFormatEnum = pgEnum('export_format', ['csv', 'xlsx'])

export const exportFrequencyEnum = pgEnum('export_frequency', ['daily', 'weekly', 'monthly'])

/**
 * Filter configuration for scheduled exports
 */
export interface ExportFilterConfig {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in'
  value: string | number | boolean | string[] | number[]
}

/**
 * Column configuration for exports
 */
export interface ExportColumnConfig {
  field: string
  label: string
  enabled: boolean
}

/**
 * Scheduled exports table for recurring data exports
 */
export const scheduledExports = pgTable(
  'scheduled_exports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Export configuration
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    entity: exportEntityEnum('entity').notNull(),
    format: exportFormatEnum('format').notNull().default('csv'),

    // Column selection
    columns: jsonb('columns').$type<ExportColumnConfig[]>().notNull(),

    // Filters
    filters: jsonb('filters').$type<ExportFilterConfig[]>().default([]),

    // Sort configuration
    sortField: varchar('sort_field', { length: 100 }),
    sortDirection: varchar('sort_direction', { length: 10 }).default('asc'),

    // Schedule configuration
    frequency: exportFrequencyEnum('frequency').notNull(),
    // For weekly: 0-6 (Sunday-Saturday), for monthly: 1-28
    scheduleDay: varchar('schedule_day', { length: 10 }),
    // Time of day in HH:MM format (24h)
    scheduleTime: varchar('schedule_time', { length: 5 }).notNull().default('06:00'),

    // Delivery settings
    emailRecipients: jsonb('email_recipients').$type<string[]>().default([]),

    // State
    isActive: boolean('is_active').default(true).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('scheduled_exports_organisation_id_idx').on(table.organisationId),
    index('scheduled_exports_created_by_id_idx').on(table.createdById),
    index('scheduled_exports_entity_idx').on(table.entity),
    index('scheduled_exports_is_active_idx').on(table.isActive),
    index('scheduled_exports_next_run_at_idx').on(table.nextRunAt),
  ],
)

export type ScheduledExport = typeof scheduledExports.$inferSelect
export type NewScheduledExport = typeof scheduledExports.$inferInsert
