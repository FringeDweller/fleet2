import { z } from 'zod'
import { db, schema } from '../../utils/db'

const fieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  color: z.string().optional(),
})

const fieldValidationSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
})

const calculatedConfigSchema = z.object({
  formula: z.string().min(1),
  dependencies: z.array(z.string()),
})

const lookupConfigSchema = z.object({
  sourceEntity: z.string().min(1),
  displayField: z.string().min(1),
  valueField: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
})

// Legacy single condition (backward compatibility)
const conditionalVisibilitySchema = z.object({
  fieldId: z.string().min(1),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'greater_than',
    'less_than',
    'is_empty',
    'is_not_empty',
  ]),
  value: z.unknown().optional(),
})

// New condition operators
const conditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'greater_than_or_equals',
  'less_than_or_equals',
  'is_empty',
  'is_not_empty',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
])

// Single condition in the advanced format
const fieldConditionSchema = z.object({
  id: z.string().min(1),
  fieldId: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
})

// Condition group with AND/OR logic
const conditionGroupSchema = z.object({
  id: z.string().min(1),
  logic: z.enum(['and', 'or']),
  conditions: z.array(fieldConditionSchema),
})

// Full conditional logic with multiple groups
const conditionalLogicSchema = z.object({
  enabled: z.boolean(),
  logic: z.enum(['and', 'or']),
  groups: z.array(conditionGroupSchema),
})

const fieldSchema = z.object({
  id: z.string().min(1),
  fieldType: z.enum([
    'text',
    'number',
    'date',
    'time',
    'datetime',
    'dropdown',
    'multi_select',
    'checkbox',
    'radio',
    'file',
    'photo',
    'signature',
    'location',
    'barcode',
    'calculated',
    'lookup',
    'section',
    'textarea',
    'email',
    'phone',
    'url',
  ]),
  label: z.string().min(1).max(255),
  placeholder: z.string().max(255).optional(),
  helpText: z.string().max(500).optional(),
  required: z.boolean().default(false),
  position: z.number().int().min(0),

  // For dropdown, multi-select, radio
  options: z.array(fieldOptionSchema).optional(),

  // For number fields
  decimalPlaces: z.number().int().min(0).max(10).optional(),
  unit: z.string().max(50).optional(),

  // For date/time fields
  dateFormat: z.string().max(50).optional(),
  timeFormat: z.string().max(50).optional(),

  // For file/photo fields
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().int().min(0).optional(),
  maxFiles: z.number().int().min(1).optional(),

  // For calculated fields
  calculatedConfig: calculatedConfigSchema.optional(),

  // For lookup fields
  lookupConfig: lookupConfigSchema.optional(),

  // For section fields
  collapsible: z.boolean().optional(),
  defaultCollapsed: z.boolean().optional(),

  // Validation
  validation: fieldValidationSchema.optional(),

  // Conditional visibility (legacy single condition)
  conditionalVisibility: conditionalVisibilitySchema.optional(),

  // Advanced conditional visibility with multiple conditions and AND/OR logic
  conditionalVisibilityAdvanced: conditionalLogicSchema.optional(),

  // Conditional required - field becomes required based on conditions
  conditionalRequired: conditionalLogicSchema.optional(),

  // Default value
  defaultValue: z.unknown().optional(),

  // Layout
  width: z.enum(['full', 'half', 'third']).optional(),
})

const settingsSchema = z.object({
  allowDraft: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  allowMultipleSubmissions: z.boolean().optional(),
  notifyOnSubmission: z.array(z.string()).optional(),
  submitButtonText: z.string().max(100).optional(),
  successMessage: z.string().max(500).optional(),
})

const createFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  fields: z.array(fieldSchema).default([]),
  settings: settingsSchema.default({}),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  const body = await readBody(event)
  const result = createFormSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Create the custom form
  const [form] = await db
    .insert(schema.customForms)
    .values({
      organisationId: user.organisationId,
      name: result.data.name,
      description: result.data.description,
      status: result.data.status,
      fields: result.data.fields,
      settings: result.data.settings,
      createdById: user.id,
      updatedById: user.id,
    })
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'custom_form',
    entityId: form!.id,
    newValues: form,
  })

  return form
})
