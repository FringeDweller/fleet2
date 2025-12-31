import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Dashboard widget position and size configuration
 */
export interface DashboardWidgetPosition {
  x: number // Column position (0-based)
  y: number // Row position (0-based)
  w: number // Width in grid units
  h: number // Height in grid units
}

/**
 * Dashboard widget options (filters, date ranges, etc.)
 */
export interface DashboardWidgetOptions {
  dateRange?: {
    start: string // ISO date string
    end: string // ISO date string
  }
  period?: 'daily' | 'weekly' | 'monthly'
  limit?: number
  filters?: Record<string, unknown>
}

/**
 * Individual widget configuration
 */
export interface DashboardWidget {
  id: string // Unique widget instance ID
  type: DashboardWidgetType
  position: DashboardWidgetPosition
  options?: DashboardWidgetOptions
}

/**
 * Available widget types
 */
export type DashboardWidgetType =
  | 'stats'
  | 'chart'
  | 'lowStock'
  | 'fuelAnomalies'
  | 'sales'
  | 'recentWorkOrders'

/**
 * Complete layout configuration
 */
export interface DashboardLayoutConfig {
  widgets: DashboardWidget[]
  columns: number // Grid columns (default 12)
  rowHeight?: number // Row height in pixels
}

/**
 * Dashboard layouts table - stores per-user dashboard configurations
 */
export const dashboardLayouts = pgTable(
  'dashboard_layouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(), // One layout per user
    layoutConfig: jsonb('layout_config').notNull().$type<DashboardLayoutConfig>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('dashboard_layouts_user_id_idx').on(table.userId)],
)

export type DashboardLayout = typeof dashboardLayouts.$inferSelect
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert
