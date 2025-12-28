import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { assetCategories } from './asset-categories'
import { customForms } from './custom-forms'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Target types that can have custom forms assigned
 */
export const formAssignmentTargetTypeEnum = pgEnum('form_assignment_target_type', [
  'asset',
  'work_order',
  'inspection',
  'operator',
])

/**
 * Custom form assignments table
 * Links custom forms to specific entity types with optional category filtering
 */
export const customFormAssignments = pgTable(
  'custom_form_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // The form being assigned
    formId: uuid('form_id')
      .notNull()
      .references(() => customForms.id, { onDelete: 'cascade' }),

    // Target type for this assignment
    targetType: formAssignmentTargetTypeEnum('target_type').notNull(),

    // Optional category filter (only applies to asset and work_order target types)
    // If set, the form will only appear for entities in this asset category
    categoryFilterId: uuid('category_filter_id').references(() => assetCategories.id, {
      onDelete: 'cascade',
    }),

    // Whether this form must be completed
    isRequired: boolean('is_required').default(false).notNull(),

    // Ordering of forms when multiple are assigned
    position: integer('position').default(0).notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('custom_form_assignments_organisation_id_idx').on(table.organisationId),
    index('custom_form_assignments_form_id_idx').on(table.formId),
    index('custom_form_assignments_target_type_idx').on(table.targetType),
    index('custom_form_assignments_category_filter_id_idx').on(table.categoryFilterId),
    index('custom_form_assignments_position_idx').on(table.position),
    // Unique constraint: same form can only be assigned once per target type + category combination
    unique('custom_form_assignments_unique_assignment').on(
      table.organisationId,
      table.formId,
      table.targetType,
      table.categoryFilterId,
    ),
  ],
)

export type CustomFormAssignment = typeof customFormAssignments.$inferSelect
export type NewCustomFormAssignment = typeof customFormAssignments.$inferInsert
