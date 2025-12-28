import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { CustomFormField } from './custom-forms'
import { customForms } from './custom-forms'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Form settings snapshot type (copied from custom-forms)
 */
export interface CustomFormSettings {
  allowDraft?: boolean
  requireSignature?: boolean
  allowMultipleSubmissions?: boolean
  notifyOnSubmission?: string[] // user IDs to notify
  submitButtonText?: string
  successMessage?: string
}

/**
 * Custom form versions table
 * Stores snapshots of form definitions when published
 */
export const customFormVersions = pgTable(
  'custom_form_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Reference to the parent form
    formId: uuid('form_id')
      .notNull()
      .references(() => customForms.id, { onDelete: 'cascade' }),

    // Version number (1, 2, 3, etc.)
    version: integer('version').notNull(),

    // Snapshot of form fields at this version
    fields: jsonb('fields').$type<CustomFormField[]>().notNull(),

    // Snapshot of form settings at this version
    settings: jsonb('settings').$type<CustomFormSettings>().default({}).notNull(),

    // Name at time of publish (in case form was renamed later)
    name: text('name').notNull(),

    // Description at time of publish
    description: text('description'),

    // Changelog describing what changed in this version
    changelog: text('changelog'),

    // Publishing metadata
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
    publishedById: uuid('published_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('custom_form_versions_organisation_id_idx').on(table.organisationId),
    index('custom_form_versions_form_id_idx').on(table.formId),
    index('custom_form_versions_form_version_idx').on(table.formId, table.version),
    index('custom_form_versions_published_at_idx').on(table.publishedAt),
  ],
)

export type CustomFormVersion = typeof customFormVersions.$inferSelect
export type NewCustomFormVersion = typeof customFormVersions.$inferInsert
