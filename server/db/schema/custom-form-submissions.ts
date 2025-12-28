import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customFormVersions } from './custom-form-versions'
import { customForms } from './custom-forms'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Status for form submissions
 */
export const formSubmissionStatusEnum = pgEnum('form_submission_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
])

/**
 * Custom form submissions table
 * Stores submitted form responses linked to specific form versions
 */
export const customFormSubmissions = pgTable(
  'custom_form_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Reference to the parent form
    formId: uuid('form_id')
      .notNull()
      .references(() => customForms.id, { onDelete: 'cascade' }),

    // Reference to the specific version this submission was made against
    versionId: uuid('version_id')
      .notNull()
      .references(() => customFormVersions.id, { onDelete: 'restrict' }),

    // The submitted responses (field ID -> value mapping)
    responses: jsonb('responses').$type<Record<string, unknown>>().default({}).notNull(),

    // Submission status
    status: formSubmissionStatusEnum('status').default('submitted').notNull(),

    // Optional notes from submitter
    submitterNotes: text('submitter_notes'),

    // Optional approval/rejection notes
    reviewNotes: text('review_notes'),

    // Context references (what entity this submission is related to)
    // e.g., assetId, workOrderId, inspectionId
    contextType: text('context_type'),
    contextId: uuid('context_id'),

    // Submission metadata
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    submittedById: uuid('submitted_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Review metadata
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('custom_form_submissions_organisation_id_idx').on(table.organisationId),
    index('custom_form_submissions_form_id_idx').on(table.formId),
    index('custom_form_submissions_version_id_idx').on(table.versionId),
    index('custom_form_submissions_status_idx').on(table.status),
    index('custom_form_submissions_submitted_at_idx').on(table.submittedAt),
    index('custom_form_submissions_context_idx').on(table.contextType, table.contextId),
    index('custom_form_submissions_submitted_by_idx').on(table.submittedById),
  ],
)

export type CustomFormSubmission = typeof customFormSubmissions.$inferSelect
export type NewCustomFormSubmission = typeof customFormSubmissions.$inferInsert
