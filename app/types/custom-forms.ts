/**
 * Shared types for custom forms
 * These match the server-side schema in server/db/schema/custom-forms.ts
 */

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
 * Custom form field structure
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

  // Conditional visibility (legacy single condition - kept for backward compatibility)
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

  // Advanced conditional visibility with multiple conditions and AND/OR logic
  conditionalVisibilityAdvanced?: ConditionalLogic

  // Conditional required - field becomes required based on conditions
  conditionalRequired?: ConditionalLogic

  // Default value
  defaultValue?: unknown

  // Layout
  width?: 'full' | 'half' | 'third'
}

/**
 * Operators for conditional logic
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'

/**
 * Single condition for conditional logic
 */
export interface FieldCondition {
  id: string
  fieldId: string
  operator: ConditionOperator
  value?: unknown
}

/**
 * Condition group with AND/OR logic
 */
export interface ConditionGroup {
  id: string
  logic: 'and' | 'or'
  conditions: FieldCondition[]
}

/**
 * Configuration for conditional visibility and required
 * Supports multiple condition groups combined with AND/OR
 */
export interface ConditionalLogic {
  enabled: boolean
  logic: 'and' | 'or'
  groups: ConditionGroup[]
}

/**
 * Form settings
 */
export interface CustomFormSettings {
  allowDraft?: boolean
  requireSignature?: boolean
  allowMultipleSubmissions?: boolean
  notifyOnSubmission?: string[]
  submitButtonText?: string
  successMessage?: string
}
