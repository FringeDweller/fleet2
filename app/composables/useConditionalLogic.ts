/**
 * Composable for evaluating conditional logic in custom forms
 * Supports multiple conditions with AND/OR grouping
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

export interface FieldCondition {
  id: string
  fieldId: string
  operator: ConditionOperator
  value?: unknown
}

export interface ConditionGroup {
  id: string
  logic: 'and' | 'or'
  conditions: FieldCondition[]
}

export interface ConditionalLogic {
  enabled: boolean
  logic: 'and' | 'or'
  groups: ConditionGroup[]
}

// Legacy single condition format for backward compatibility
export interface LegacyConditionalVisibility {
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

export interface CustomFormFieldForCondition {
  id: string
  fieldType: string
  label: string
  options?: Array<{ label: string; value: string }>
  conditionalVisibility?: LegacyConditionalVisibility
  conditionalVisibilityAdvanced?: ConditionalLogic
  conditionalRequired?: ConditionalLogic
  required: boolean
}

/**
 * Evaluate a single condition against form values
 */
export function evaluateCondition(
  condition: FieldCondition,
  formValues: Record<string, unknown>,
): boolean {
  const fieldValue = formValues[condition.fieldId]

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value

    case 'not_equals':
      return fieldValue !== condition.value

    case 'contains': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase())
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value)
      }
      return false
    }

    case 'not_contains': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return !fieldValue.toLowerCase().includes(condition.value.toLowerCase())
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(condition.value)
      }
      return true
    }

    case 'greater_than': {
      const numValue = Number(fieldValue)
      const numCondition = Number(condition.value)
      if (Number.isNaN(numValue) || Number.isNaN(numCondition)) return false
      return numValue > numCondition
    }

    case 'less_than': {
      const numValue = Number(fieldValue)
      const numCondition = Number(condition.value)
      if (Number.isNaN(numValue) || Number.isNaN(numCondition)) return false
      return numValue < numCondition
    }

    case 'greater_than_or_equals': {
      const numValue = Number(fieldValue)
      const numCondition = Number(condition.value)
      if (Number.isNaN(numValue) || Number.isNaN(numCondition)) return false
      return numValue >= numCondition
    }

    case 'less_than_or_equals': {
      const numValue = Number(fieldValue)
      const numCondition = Number(condition.value)
      if (Number.isNaN(numValue) || Number.isNaN(numCondition)) return false
      return numValue <= numCondition
    }

    case 'is_empty':
      return (
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      )

    case 'is_not_empty':
      return !(
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      )

    case 'starts_with': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().startsWith(condition.value.toLowerCase())
      }
      return false
    }

    case 'ends_with': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().endsWith(condition.value.toLowerCase())
      }
      return false
    }

    case 'in': {
      if (Array.isArray(condition.value)) {
        return condition.value.includes(fieldValue)
      }
      return false
    }

    case 'not_in': {
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(fieldValue)
      }
      return true
    }

    default:
      return false
  }
}

/**
 * Evaluate a condition group
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  formValues: Record<string, unknown>,
): boolean {
  if (group.conditions.length === 0) return true

  if (group.logic === 'and') {
    return group.conditions.every((condition) => evaluateCondition(condition, formValues))
  } else {
    return group.conditions.some((condition) => evaluateCondition(condition, formValues))
  }
}

/**
 * Evaluate conditional logic (multiple groups with AND/OR)
 */
export function evaluateConditionalLogic(
  conditionalLogic: ConditionalLogic | undefined,
  formValues: Record<string, unknown>,
): boolean {
  if (!conditionalLogic || !conditionalLogic.enabled) return true
  if (conditionalLogic.groups.length === 0) return true

  if (conditionalLogic.logic === 'and') {
    return conditionalLogic.groups.every((group) => evaluateConditionGroup(group, formValues))
  } else {
    return conditionalLogic.groups.some((group) => evaluateConditionGroup(group, formValues))
  }
}

/**
 * Convert legacy single condition to new format
 */
export function convertLegacyCondition(legacy: LegacyConditionalVisibility): ConditionalLogic {
  return {
    enabled: true,
    logic: 'and',
    groups: [
      {
        id: crypto.randomUUID(),
        logic: 'and',
        conditions: [
          {
            id: crypto.randomUUID(),
            fieldId: legacy.fieldId,
            operator: legacy.operator,
            value: legacy.value,
          },
        ],
      },
    ],
  }
}

/**
 * Check if a field should be visible based on conditions
 */
export function isFieldVisible(
  field: CustomFormFieldForCondition,
  formValues: Record<string, unknown>,
): boolean {
  // Check advanced conditional visibility first
  if (field.conditionalVisibilityAdvanced) {
    return evaluateConditionalLogic(field.conditionalVisibilityAdvanced, formValues)
  }

  // Fall back to legacy single condition
  if (field.conditionalVisibility) {
    const converted = convertLegacyCondition(field.conditionalVisibility)
    return evaluateConditionalLogic(converted, formValues)
  }

  // No conditions - field is visible
  return true
}

/**
 * Check if a field is required based on conditions
 */
export function isFieldRequired(
  field: CustomFormFieldForCondition,
  formValues: Record<string, unknown>,
): boolean {
  // If field has conditional required logic
  if (field.conditionalRequired) {
    return evaluateConditionalLogic(field.conditionalRequired, formValues)
  }

  // Fall back to static required flag
  return field.required
}

/**
 * Get human-readable description of an operator
 */
export function getOperatorLabel(operator: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    not_contains: 'does not contain',
    greater_than: 'is greater than',
    less_than: 'is less than',
    greater_than_or_equals: 'is greater than or equal to',
    less_than_or_equals: 'is less than or equal to',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    starts_with: 'starts with',
    ends_with: 'ends with',
    in: 'is one of',
    not_in: 'is not one of',
  }
  return labels[operator] || operator
}

/**
 * Get operators available for a field type
 */
export function getOperatorsForFieldType(fieldType: string): ConditionOperator[] {
  const textOperators: ConditionOperator[] = [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
  ]

  const numberOperators: ConditionOperator[] = [
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_than_or_equals',
    'less_than_or_equals',
    'is_empty',
    'is_not_empty',
  ]

  const selectionOperators: ConditionOperator[] = [
    'equals',
    'not_equals',
    'in',
    'not_in',
    'is_empty',
    'is_not_empty',
  ]

  const multiSelectOperators: ConditionOperator[] = [
    'contains',
    'not_contains',
    'is_empty',
    'is_not_empty',
  ]

  const booleanOperators: ConditionOperator[] = ['equals', 'not_equals']

  switch (fieldType) {
    case 'number':
    case 'calculated':
      return numberOperators
    case 'dropdown':
    case 'radio':
      return selectionOperators
    case 'multi_select':
      return multiSelectOperators
    case 'checkbox':
      return booleanOperators
    default:
      // text, textarea, email, phone, url and other text-like fields
      return textOperators
  }
}

/**
 * Composable for reactive conditional logic evaluation
 */
export function useConditionalLogic(
  fields: MaybeRef<CustomFormFieldForCondition[]>,
  formValues: MaybeRef<Record<string, unknown>>,
) {
  const fieldsRef = toRef(fields)
  const valuesRef = toRef(formValues)

  /**
   * Get visibility state for all fields
   */
  const fieldVisibility = computed(() => {
    const visibility: Record<string, boolean> = {}
    for (const field of fieldsRef.value) {
      visibility[field.id] = isFieldVisible(field, valuesRef.value)
    }
    return visibility
  })

  /**
   * Get required state for all fields (considering conditions)
   */
  const fieldRequired = computed(() => {
    const required: Record<string, boolean> = {}
    for (const field of fieldsRef.value) {
      // Only check required if field is visible
      if (isFieldVisible(field, valuesRef.value)) {
        required[field.id] = isFieldRequired(field, valuesRef.value)
      } else {
        // Hidden fields are not required
        required[field.id] = false
      }
    }
    return required
  })

  /**
   * Get visible fields only
   */
  const visibleFields = computed(() => {
    return fieldsRef.value.filter((field) => fieldVisibility.value[field.id])
  })

  /**
   * Check if a specific field is visible
   */
  function checkFieldVisibility(fieldId: string): boolean {
    return fieldVisibility.value[fieldId] ?? true
  }

  /**
   * Check if a specific field is required
   */
  function checkFieldRequired(fieldId: string): boolean {
    return fieldRequired.value[fieldId] ?? false
  }

  /**
   * Get all fields that can be used as condition sources
   * (excludes sections and calculated fields)
   */
  const conditionSourceFields = computed(() => {
    return fieldsRef.value.filter(
      (field) => !['section', 'calculated', 'signature', 'file', 'photo'].includes(field.fieldType),
    )
  })

  return {
    fieldVisibility,
    fieldRequired,
    visibleFields,
    checkFieldVisibility,
    checkFieldRequired,
    conditionSourceFields,
  }
}
