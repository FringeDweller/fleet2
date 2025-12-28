import {
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { geofences } from './geofences'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'

/**
 * Job Site Visit Status
 * - in_progress: Vehicle is currently at the job site
 * - completed: Vehicle has left the job site
 */
export const jobSiteVisitStatusEnum = pgEnum('job_site_visit_status', ['in_progress', 'completed'])

/**
 * Job Site Visits - Track vehicle entry/exit times at job sites
 *
 * Records are created when a vehicle enters a job site geofence (category = 'work_site')
 * and updated with exit time when the vehicle leaves.
 *
 * @requirement REQ-1206-AC-02
 * @requirement REQ-1206-AC-03
 */
export const jobSiteVisits = pgTable(
  'job_site_visits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    // The job site geofence
    geofenceId: uuid('geofence_id')
      .notNull()
      .references(() => geofences.id, { onDelete: 'cascade' }),
    // The vehicle/asset visiting the site
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Optional link to operator session if vehicle was being operated
    operatorSessionId: uuid('operator_session_id').references(() => operatorSessions.id, {
      onDelete: 'set null',
    }),
    // Visit status
    status: jobSiteVisitStatusEnum('status').notNull().default('in_progress'),
    // Entry/exit times
    entryTime: timestamp('entry_time', { withTimezone: true }).notNull(),
    exitTime: timestamp('exit_time', { withTimezone: true }),
    // Entry/exit coordinates
    entryLatitude: decimal('entry_latitude', { precision: 10, scale: 7 }).notNull(),
    entryLongitude: decimal('entry_longitude', { precision: 10, scale: 7 }).notNull(),
    exitLatitude: decimal('exit_latitude', { precision: 10, scale: 7 }),
    exitLongitude: decimal('exit_longitude', { precision: 10, scale: 7 }),
    // Calculated duration in minutes (populated on exit)
    durationMinutes: integer('duration_minutes'),
    // Optional notes about the visit
    notes: text('notes'),
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Primary query: find visits for an organisation
    index('job_site_visits_organisation_id_idx').on(table.organisationId),
    // Find visits for a specific geofence (job site)
    index('job_site_visits_geofence_id_idx').on(table.geofenceId),
    // Find visits for a specific asset
    index('job_site_visits_asset_id_idx').on(table.assetId),
    // Find in-progress visits
    index('job_site_visits_status_idx').on(table.status),
    // Query by entry time for reports
    index('job_site_visits_entry_time_idx').on(table.entryTime),
    // Composite index for common query pattern: org + date range
    index('job_site_visits_org_entry_time_idx').on(table.organisationId, table.entryTime),
    // Composite index for finding in-progress visits per asset
    index('job_site_visits_asset_status_idx').on(table.assetId, table.status),
  ],
)

export type JobSiteVisit = typeof jobSiteVisits.$inferSelect
export type NewJobSiteVisit = typeof jobSiteVisits.$inferInsert
