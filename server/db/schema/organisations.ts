import {
  boolean,
  decimal,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const organisations = pgTable('organisations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 7 }).default('#0066cc'),
  isActive: boolean('is_active').default(true).notNull(),
  // Inventory settings
  preventNegativeStock: boolean('prevent_negative_stock').default(false).notNull(),
  // Work order approval settings
  // Null means no approval required; any value means approval is required for costs above this threshold
  workOrderApprovalThreshold: decimal('work_order_approval_threshold', {
    precision: 12,
    scale: 2,
  }),
  // If true, approval is required for all work orders regardless of cost
  requireApprovalForAllWorkOrders: boolean('require_approval_for_all_work_orders')
    .default(false)
    .notNull(),
  // Location tracking settings (REQ-1201)
  locationTrackingEnabled: boolean('location_tracking_enabled').default(true).notNull(),
  // Interval in minutes (1-60, default 5 minutes)
  locationTrackingInterval: integer('location_tracking_interval').default(5).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Organisation = typeof organisations.$inferSelect
export type NewOrganisation = typeof organisations.$inferInsert
