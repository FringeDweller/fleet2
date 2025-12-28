import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

/**
 * Status for custom forms
 */
export const customFormStatusEnum = pgEnum('custom_form_status', ['draft', 'active', 'archived'])

/**
 * Field types for custom form fields
 * 16+ types as per requirements
 */
export type CustomFormFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'dropdown'
  | 'multi_select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'photo'
  | 'signature'
  | 'location'
  | 'barcode'
  | 'calculated'
  | 'lookup'
  | 'section'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'

/**
 * Option structure for dropdown, multi-select, radio fields
 */
export interface CustomFormFieldOption {
  label: string
  value: string
  color?: string
}

/**
 * Validation rules for form fields
 */
export interface CustomFormFieldValidation {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  patternMessage?: string
}

/**
 * Configuration for calculated fields
 */
export interface CalculatedFieldConfig {
  formula: string
  dependencies: string[] // field IDs that this calculation depends on
}

/**
 * Configuration for lookup fields
 */
export interface LookupFieldConfig {
  sourceEntity: string // e.g., 'assets', 'users', 'parts'
  displayField: string
  valueField: string
  filters?: Record<string, unknown>
}

/**
 * Custom form field structure (stored in JSONB)
 */
export interface CustomFormField {
  id: string
  fieldType: CustomFormFieldType
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  position: number

  // For dropdown, multi-select, radio
  options?: CustomFormFieldOption[]

  // For number fields
  decimalPlaces?: number
  unit?: string

  // For date/time fields
  dateFormat?: string
  timeFormat?: string

  // For file/photo fields
  allowedFileTypes?: string[]
  maxFileSize?: number // in bytes
  maxFiles?: number

  // For calculated fields
  calculatedConfig?: CalculatedFieldConfig

  // For lookup fields
  lookupConfig?: LookupFieldConfig

  // For section fields
  collapsible?: boolean
  defaultCollapsed?: boolean

  // Validation
  validation?: CustomFormFieldValidation

  // Conditional visibility
  conditionalVisibility?: {
    fieldId: string
    operator:
      | 'equals'
      | 'not_equals'
      | 'contains'
      | 'greater_than'
      | 'less_than'
      | 'is_empty'
      | 'is_not_empty'
    value?: unknown
  }

  // Default value
  defaultValue?: unknown

  // Layout
  width?: 'full' | 'half' | 'third'
}

/**
 * Custom forms table
 */
export const customForms = pgTable(
  'custom_forms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: customFormStatusEnum('status').default('draft').notNull(),

    // Form fields stored as JSONB array
    fields: jsonb('fields').$type<CustomFormField[]>().default([]).notNull(),

    // Form settings
    settings: jsonb('settings')
      .$type<{
        allowDraft?: boolean
        requireSignature?: boolean
        allowMultipleSubmissions?: boolean
        notifyOnSubmission?: string[] // user IDs to notify
        submitButtonText?: string
        successMessage?: string
      }>()
      .default({}),

    // Version for offline sync support
    version: integer('version').default(1).notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id'),
    updatedById: uuid('updated_by_id'),
  },
  (table) => [
    index('custom_forms_organisation_id_idx').on(table.organisationId),
    index('custom_forms_status_idx').on(table.status),
    index('custom_forms_name_idx').on(table.name),
  ],
)

export type CustomForm = typeof customForms.$inferSelect
export type NewCustomForm = typeof customForms.$inferInsert
