import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const certificationEnforcementEnum = pgEnum('certification_enforcement', ['block', 'warn'])

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
  // Certification enforcement mode: 'block' prevents log-on, 'warn' allows with warning
  certificationEnforcement: certificationEnforcementEnum('certification_enforcement')
    .default('warn')
    .notNull(),
  // Handover threshold in minutes - sessions within this time are linked (US-8.5)
  // Default 30 minutes
  handoverThresholdMinutes: integer('handover_threshold_minutes').default(30).notNull(),
  // Defect escalation settings (US-9.5)
  // If true, auto-create work orders when defects are created (for major/critical severity)
  autoCreateWorkOrderOnDefect: boolean('auto_create_work_order_on_defect').default(true).notNull(),
  // Vehicle operation blocking settings (US-9.6)
  // If true, vehicles with critical defects are blocked from operation
  blockVehicleOnCriticalDefect: boolean('block_vehicle_on_critical_defect').default(true).notNull(),
  // Defect severities that block vehicle operation (stored as JSON array)
  // Default: ['critical'] - only critical defects block operation
  // Options: 'minor', 'major', 'critical'
  blockingDefectSeverities: text('blocking_defect_severities').default('["critical"]').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Organisation = typeof organisations.$inferSelect
export type NewOrganisation = typeof organisations.$inferInsert
