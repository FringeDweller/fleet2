<script setup lang="ts">
import type { ConditionOperator, FieldCondition } from '~/composables/useConditionalLogic'
import { getOperatorLabel, getOperatorsForFieldType } from '~/composables/useConditionalLogic'

interface FormField {
  id: string
  fieldType: string
  label: string
  options?: Array<{ label: string; value: string }>
}

const props = defineProps<{
  condition: FieldCondition
  fields: FormField[]
  currentFieldId: string // The field being configured (to exclude from source fields)
}>()

const emit = defineEmits<{
  update: [condition: FieldCondition]
  remove: []
}>()

// Get available source fields (fields before current field or all fields depending on form design)
const sourceFields = computed(() => {
  return props.fields.filter(
    (f) =>
      f.id !== props.currentFieldId &&
      !['section', 'calculated', 'signature', 'file', 'photo'].includes(f.fieldType),
  )
})

// Get selected source field
const selectedField = computed(() => {
  return props.fields.find((f) => f.id === props.condition.fieldId)
})

// Get available operators for selected field type
const availableOperators = computed(() => {
  if (!selectedField.value) return []
  return getOperatorsForFieldType(selectedField.value.fieldType)
})

// Check if operator needs a value input
const needsValue = computed(() => {
  const noValueOperators: ConditionOperator[] = ['is_empty', 'is_not_empty']
  return !noValueOperators.includes(props.condition.operator)
})

// Check if field is a selection type (dropdown, radio, multi-select)
const isSelectionField = computed(() => {
  if (!selectedField.value) return false
  return ['dropdown', 'radio', 'multi_select'].includes(selectedField.value.fieldType)
})

// Check if field is checkbox type
const isCheckboxField = computed(() => {
  return selectedField.value?.fieldType === 'checkbox'
})

// Format operators for select
const operatorOptions = computed(() => {
  return availableOperators.value.map((op) => ({
    label: getOperatorLabel(op),
    value: op,
  }))
})

// Format source fields for select
const fieldOptions = computed(() => {
  return sourceFields.value.map((f) => ({
    label: f.label,
    value: f.id,
  }))
})

// Handle field change
function handleFieldChange(fieldId: string | null) {
  if (!fieldId) return

  const field = props.fields.find((f) => f.id === fieldId)
  if (!field) return

  const operators = getOperatorsForFieldType(field.fieldType)
  const newOperator = operators.includes(props.condition.operator)
    ? props.condition.operator
    : operators[0]

  emit('update', {
    ...props.condition,
    fieldId,
    operator: newOperator ?? 'equals',
    value: undefined,
  })
}

// Handle operator change
function handleOperatorChange(operator: ConditionOperator | null) {
  if (!operator) return

  const noValueOperators: ConditionOperator[] = ['is_empty', 'is_not_empty']
  const clearValue = noValueOperators.includes(operator)

  emit('update', {
    ...props.condition,
    operator,
    value: clearValue ? undefined : props.condition.value,
  })
}

// Handle value change
function handleValueChange(value: unknown) {
  emit('update', {
    ...props.condition,
    value,
  })
}
</script>

<template>
  <div class="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
    <!-- Field selector -->
    <USelect
      :model-value="condition.fieldId"
      :items="fieldOptions"
      placeholder="Select field..."
      class="flex-1 min-w-[140px]"
      @update:model-value="handleFieldChange"
    />

    <!-- Operator selector -->
    <USelect
      :model-value="condition.operator"
      :items="operatorOptions"
      placeholder="Operator..."
      class="flex-1 min-w-[140px]"
      :disabled="!condition.fieldId"
      @update:model-value="handleOperatorChange"
    />

    <!-- Value input -->
    <template v-if="needsValue && condition.fieldId">
      <!-- Checkbox: boolean select -->
      <USelect
        v-if="isCheckboxField"
        :model-value="condition.value === true ? 'true' : condition.value === false ? 'false' : undefined"
        :items="[
          { label: 'Checked', value: 'true' },
          { label: 'Not Checked', value: 'false' },
        ]"
        placeholder="Value..."
        class="flex-1 min-w-[100px]"
        @update:model-value="(v: string | null) => handleValueChange(v === 'true')"
      />

      <!-- Selection field: use options -->
      <USelect
        v-else-if="isSelectionField && selectedField?.options"
        :model-value="condition.value as string"
        :items="selectedField.options.map((o) => ({ label: o.label, value: o.value }))"
        placeholder="Value..."
        class="flex-1 min-w-[100px]"
        @update:model-value="handleValueChange"
      />

      <!-- Number field: number input -->
      <UInput
        v-else-if="selectedField?.fieldType === 'number'"
        :model-value="condition.value as number"
        type="number"
        placeholder="Value..."
        class="flex-1 min-w-[100px]"
        @update:model-value="handleValueChange"
      />

      <!-- Text/other field: text input -->
      <UInput
        v-else
        :model-value="condition.value as string"
        placeholder="Value..."
        class="flex-1 min-w-[100px]"
        @update:model-value="handleValueChange"
      />
    </template>

    <!-- Empty placeholder when no value needed -->
    <div v-else-if="!needsValue" class="flex-1 min-w-[100px]" />

    <!-- Remove button -->
    <UButton
      icon="i-lucide-x"
      color="error"
      variant="ghost"
      size="xs"
      @click="emit('remove')"
    />
  </div>
</template>
