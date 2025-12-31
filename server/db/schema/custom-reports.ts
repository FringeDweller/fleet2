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

/**
 * Custom Report Builder (US-14.7)
 *
 * Enables users to create custom reports by:
 * - Selecting a data source (assets, work_orders, maintenance_schedules, fuel_transactions, inspections)
 * - Choosing which columns to include
 * - Applying filters (date range, status, asset type, etc.)
 * - Grouping and aggregating data (count, sum, avg)
 * - Saving report definitions for reuse
 */

export const customReportDataSourceEnum = pgEnum('custom_report_data_source', [
  'assets',
  'work_orders',
  'maintenance_schedules',
  'fuel_transactions',
  'inspections',
])

export const customReportAggregationTypeEnum = pgEnum('custom_report_aggregation_type', [
  'count',
  'sum',
  'avg',
  'min',
  'max',
])

/**
 * Column definition for custom reports
 */
export interface CustomReportColumn {
  field: string
  label?: string
  visible: boolean
  order: number
}

/**
 * Filter definition for custom reports
 */
export interface CustomReportFilter {
  field: string
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'in'
    | 'notIn'
    | 'isNull'
    | 'isNotNull'
  value?: string | number | boolean | string[] | number[] | null
}

/**
 * Date range filter (commonly used across all data sources)
 */
export interface CustomReportDateRange {
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  field: string // e.g., 'createdAt', 'transactionDate', 'startedAt'
}

/**
 * Aggregation definition for custom reports
 */
export interface CustomReportAggregation {
  field: string
  type: 'count' | 'sum' | 'avg' | 'min' | 'max'
  alias?: string
}

/**
 * Complete report definition stored in JSONB
 */
export interface CustomReportDefinition {
  columns: CustomReportColumn[]
  filters: CustomReportFilter[]
  dateRange?: CustomReportDateRange
  groupBy?: string[]
  aggregations?: CustomReportAggregation[]
  orderBy?: {
    field: string
    direction: 'asc' | 'desc'
  }
  limit?: number
}

export const customReports = pgTable(
  'custom_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    dataSource: customReportDataSourceEnum('data_source').notNull(),
    definition: jsonb('definition').notNull().$type<CustomReportDefinition>(),
    isShared: boolean('is_shared').default(false).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('custom_reports_organisation_id_idx').on(table.organisationId),
    index('custom_reports_user_id_idx').on(table.userId),
    index('custom_reports_data_source_idx').on(table.dataSource),
    index('custom_reports_is_shared_idx').on(table.isShared),
    index('custom_reports_is_archived_idx').on(table.isArchived),
  ],
)

export type CustomReport = typeof customReports.$inferSelect
export type NewCustomReport = typeof customReports.$inferInsert
