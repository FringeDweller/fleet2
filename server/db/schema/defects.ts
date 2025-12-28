import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { inspectionItems } from './inspection-items'
import { inspections } from './inspections'
import { organisations } from './organisations'
import { users } from './users'
import { workOrders } from './work-orders'

export const defectSeverityEnum = pgEnum('defect_severity', ['minor', 'major', 'critical'])

export const defectStatusEnum = pgEnum('defect_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
])

export const defects = pgTable(
  'defects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Link to the original inspection that created this defect
    inspectionId: uuid('inspection_id').references(() => inspections.id, { onDelete: 'set null' }),
    // Link to the specific inspection item that failed
    inspectionItemId: uuid('inspection_item_id').references(() => inspectionItems.id, {
      onDelete: 'set null',
    }),
    // Auto-generated work order for this defect
    workOrderId: uuid('work_order_id').references(() => workOrders.id, { onDelete: 'set null' }),
    // Who reported the defect
    reportedById: uuid('reported_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    // Defect details
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }),
    severity: defectSeverityEnum('severity').notNull().default('minor'),
    status: defectStatusEnum('status').notNull().default('open'),
    // Location on the asset (e.g., "front left tire", "engine compartment")
    location: varchar('location', { length: 255 }),
    // Photo URLs stored as JSON array
    photos: text('photos'),
    // Resolution details
    resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    // Timestamps
    reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('defects_organisation_id_idx').on(table.organisationId),
    index('defects_asset_id_idx').on(table.assetId),
    index('defects_inspection_id_idx').on(table.inspectionId),
    index('defects_inspection_item_id_idx').on(table.inspectionItemId),
    index('defects_work_order_id_idx').on(table.workOrderId),
    index('defects_status_idx').on(table.status),
    index('defects_severity_idx').on(table.severity),
    index('defects_reported_at_idx').on(table.reportedAt),
  ],
)

export type Defect = typeof defects.$inferSelect
export type NewDefect = typeof defects.$inferInsert
