import { pgTable, uuid, varchar, text, timestamp, boolean, integer, index, pgEnum } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { assets } from './assets'
import { assetCategories } from './asset-categories'
import { taskTemplates } from './task-templates'
import { users } from './users'
import { workOrders } from './work-orders'

export const scheduleIntervalTypeEnum = pgEnum('schedule_interval_type', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'custom'
])

export const maintenanceSchedules = pgTable(
  'maintenance_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Basic info
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),

    // Assignment - either to specific asset OR to category (not both)
    assetId: uuid('asset_id')
      .references(() => assets.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .references(() => assetCategories.id, { onDelete: 'cascade' }),

    // Task template to use when generating work orders
    templateId: uuid('template_id')
      .references(() => taskTemplates.id, { onDelete: 'set null' }),

    // Time-based scheduling
    intervalType: scheduleIntervalTypeEnum('interval_type').notNull(),
    intervalValue: integer('interval_value').default(1).notNull(), // e.g., every 2 weeks

    // For weekly schedules: day of week (0=Sunday, 6=Saturday)
    dayOfWeek: integer('day_of_week'),
    // For monthly/quarterly/annually: day of month (1-31)
    dayOfMonth: integer('day_of_month'),
    // For annually: month (1-12)
    monthOfYear: integer('month_of_year'),

    // Schedule timing
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }), // null = no end date

    // Tracking
    lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),
    nextDueDate: timestamp('next_due_date', { withTimezone: true }),

    // Work order settings
    leadTimeDays: integer('lead_time_days').default(7).notNull(), // Create WO this many days before due
    defaultPriority: varchar('default_priority', { length: 20 }).default('medium'),
    defaultAssigneeId: uuid('default_assignee_id')
      .references(() => users.id, { onDelete: 'set null' }),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('maintenance_schedules_organisation_id_idx').on(table.organisationId),
    index('maintenance_schedules_asset_id_idx').on(table.assetId),
    index('maintenance_schedules_category_id_idx').on(table.categoryId),
    index('maintenance_schedules_next_due_date_idx').on(table.nextDueDate),
    index('maintenance_schedules_is_active_idx').on(table.isActive),
    index('maintenance_schedules_is_archived_idx').on(table.isArchived)
  ]
)

// Track which work orders were generated from which schedule
export const maintenanceScheduleWorkOrders = pgTable(
  'maintenance_schedule_work_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => maintenanceSchedules.id, { onDelete: 'cascade' }),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('maintenance_schedule_wo_schedule_id_idx').on(table.scheduleId),
    index('maintenance_schedule_wo_work_order_id_idx').on(table.workOrderId)
  ]
)

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect
export type NewMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert
export type MaintenanceScheduleWorkOrder = typeof maintenanceScheduleWorkOrders.$inferSelect
export type NewMaintenanceScheduleWorkOrder = typeof maintenanceScheduleWorkOrders.$inferInsert
