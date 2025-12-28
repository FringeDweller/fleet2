import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'
import { workOrders } from './work-orders'

export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected'])

export const workOrderApprovals = pgTable(
  'work_order_approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    status: approvalStatusEnum('status').default('pending').notNull(),

    // Who requested approval
    requestedById: uuid('requested_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    requestNotes: text('request_notes'),

    // Who approved/rejected
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),

    // Emergency override
    isEmergencyOverride: boolean('is_emergency_override').default(false).notNull(),
    emergencyReason: text('emergency_reason'),
    emergencyOverrideById: uuid('emergency_override_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    emergencyOverrideAt: timestamp('emergency_override_at', { withTimezone: true }),

    // Estimated cost at time of request (for audit trail)
    estimatedCostAtRequest: text('estimated_cost_at_request'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('work_order_approvals_organisation_id_idx').on(table.organisationId),
    index('work_order_approvals_work_order_id_idx').on(table.workOrderId),
    index('work_order_approvals_status_idx').on(table.status),
    index('work_order_approvals_requested_by_id_idx').on(table.requestedById),
    index('work_order_approvals_reviewed_by_id_idx').on(table.reviewedById),
  ],
)

export type WorkOrderApproval = typeof workOrderApprovals.$inferSelect
export type NewWorkOrderApproval = typeof workOrderApprovals.$inferInsert
