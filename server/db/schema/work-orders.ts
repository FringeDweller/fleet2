import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { organisations } from './organisations'
import { taskTemplates } from './task-templates'
import { users } from './users'

export const workOrderPriorityEnum = pgEnum('work_order_priority', [
  'low',
  'medium',
  'high',
  'critical',
])
export const workOrderStatusEnum = pgEnum('work_order_status', [
  'draft',
  'open',
  'in_progress',
  'pending_parts',
  'completed',
  'closed',
])

export const workOrders = pgTable(
  'work_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    workOrderNumber: varchar('work_order_number', { length: 20 }).notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    templateId: uuid('template_id').references(() => taskTemplates.id, { onDelete: 'set null' }),
    assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    priority: workOrderPriorityEnum('priority').default('medium').notNull(),
    status: workOrderStatusEnum('status').default('draft').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    estimatedDuration: integer('estimated_duration'),
    actualDuration: integer('actual_duration'),
    notes: text('notes'),
    completionNotes: text('completion_notes'),
    signatureUrl: varchar('signature_url', { length: 500 }),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('work_orders_organisation_id_idx').on(table.organisationId),
    index('work_orders_asset_id_idx').on(table.assetId),
    index('work_orders_assigned_to_id_idx').on(table.assignedToId),
    index('work_orders_status_idx').on(table.status),
    index('work_orders_priority_idx').on(table.priority),
    index('work_orders_due_date_idx').on(table.dueDate),
    index('work_orders_is_archived_idx').on(table.isArchived),
    unique('work_orders_org_work_order_number_unique').on(
      table.organisationId,
      table.workOrderNumber,
    ),
  ],
)

export type WorkOrder = typeof workOrders.$inferSelect
export type NewWorkOrder = typeof workOrders.$inferInsert
