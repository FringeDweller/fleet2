<script setup lang="ts">
/**
 * Filter Builder Component for Custom Reports
 *
 * Allows users to add/remove filter conditions for report queries.
 * Supports operators: eq, neq, gt, gte, lt, lte, like, in, isNull
 */
import type {
  FieldDefinition,
  FieldType,
  FilterOperator,
  ReportFilter,
} from '~/composables/useReportBuilder'

interface Props {
  filters: ReportFilter[]
  availableFields: FieldDefinition[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  add: [filter?: Partial<ReportFilter>]
  update: [id: string, updates: Partial<Omit<ReportFilter, 'id'>>]
  remove: [id: string]
  clear: []
}>()

// Operator labels for display
const operatorLabels: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: 'greater than',
  gte: 'greater than or equal',
  lt: 'less than',
  lte: 'less than or equal',
  like: 'contains',
  in: 'in list',
  notIn: 'not in list',
  isNull: 'is empty',
  isNotNull: 'is not empty',
}

// Operators available per field type
const operatorsByFieldType: Record<FieldType, FilterOperator[]> = {
  string: ['eq', 'neq', 'like', 'in', 'notIn', 'isNull', 'isNotNull'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'isNull', 'isNotNull'],
  boolean: ['eq', 'neq', 'isNull', 'isNotNull'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  uuid: ['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull'],
}

// Get operators for a specific field
function getOperatorsForField(fieldKey: string): FilterOperator[] {
  const field = props.availableFields.find((f) => f.key === fieldKey)
  if (!field) return ['eq', 'neq', 'isNull', 'isNotNull']
  return operatorsByFieldType[field.type] || ['eq', 'neq', 'isNull', 'isNotNull']
}

// Get field definition by key
function getFieldByKey(fieldKey: string): FieldDefinition | undefined {
  return props.availableFields.find((f) => f.key === fieldKey)
}

// Check if operator requires a value
function needsValue(operator: FilterOperator): boolean {
  return !['isNull', 'isNotNull'].includes(operator)
}

// Check if operator expects array input
function isArrayOperator(operator: FilterOperator): boolean {
  return ['in', 'notIn'].includes(operator)
}

// Field options for select
const fieldOptions = computed(() => {
  return props.availableFields.map((f) => ({
    label: f.label,
    value: f.key,
  }))
})

// Get operator options for a filter
function getOperatorOptions(fieldKey: string) {
  const operators = getOperatorsForField(fieldKey)
  return operators.map((op) => ({
    label: operatorLabels[op],
    value: op,
  }))
}

// Boolean options for boolean fields
const booleanOptions = [
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
]

// Handle field change
function handleFieldChange(filterId: string, fieldKey: string | null) {
  if (!fieldKey) return

  const operators = getOperatorsForField(fieldKey)
  const currentFilter = props.filters.find((f) => f.id === filterId)
  const newOperator =
    currentFilter && operators.includes(currentFilter.operator)
      ? currentFilter.operator
      : operators[0]

  emit('update', filterId, {
    field: fieldKey,
    operator: newOperator ?? 'eq',
    value: undefined,
  })
}

// Handle operator change
function handleOperatorChange(filterId: string, operator: FilterOperator | null) {
  if (!operator) return

  const clearValue = !needsValue(operator)
  emit('update', filterId, {
    operator,
    value: clearValue ? undefined : undefined,
  })
}

// Handle value change for regular inputs
function handleValueChange(filterId: string, value: string | number | boolean | null) {
  emit('update', filterId, { value })
}

// Handle value change for array operators (in, notIn)
function handleArrayValueChange(filterId: string, value: string) {
  // Split by comma and trim whitespace
  const arrayValue = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  emit('update', filterId, { value: arrayValue })
}

// Convert array value back to string for display
function arrayValueToString(value: ReportFilter['value']): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return ''
}

// Add new filter
function handleAddFilter() {
  emit('add')
}

// Remove filter
function handleRemoveFilter(id: string) {
  emit('remove', id)
}

// Clear all filters
function handleClearAll() {
  emit('clear')
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-filter" class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-medium">Filters</span>
        <UBadge
          v-if="filters.length > 0"
          color="info"
          variant="subtle"
          size="xs"
        >
          {{ filters.length }}
        </UBadge>
      </div>
      <UButton
        v-if="filters.length > 0"
        label="Clear All"
        icon="i-lucide-x"
        variant="ghost"
        size="xs"
        color="error"
        @click="handleClearAll"
      />
    </div>

    <!-- Filter List -->
    <div v-if="filters.length > 0" class="space-y-2">
      <div
        v-for="filter in filters"
        :key="filter.id"
        class="flex items-center gap-2 p-2 bg-muted/30 rounded-md"
      >
        <!-- Field selector -->
        <USelect
          :model-value="filter.field"
          :items="fieldOptions"
          placeholder="Select field..."
          class="flex-1 min-w-[140px]"
          @update:model-value="handleFieldChange(filter.id, $event)"
        />

        <!-- Operator selector -->
        <USelect
          :model-value="filter.operator"
          :items="getOperatorOptions(filter.field)"
          placeholder="Operator..."
          class="flex-1 min-w-[140px]"
          :disabled="!filter.field"
          @update:model-value="handleOperatorChange(filter.id, $event)"
        />

        <!-- Value input (conditional) -->
        <template v-if="needsValue(filter.operator) && filter.field">
          <!-- Boolean field: select -->
          <USelect
            v-if="getFieldByKey(filter.field)?.type === 'boolean'"
            :model-value="filter.value === true ? 'true' : filter.value === false ? 'false' : undefined"
            :items="booleanOptions"
            placeholder="Value..."
            class="flex-1 min-w-[100px]"
            @update:model-value="(v: string | null) => handleValueChange(filter.id, v === 'true')"
          />

          <!-- Array operator (in, notIn): text input for comma-separated values -->
          <UInput
            v-else-if="isArrayOperator(filter.operator)"
            :model-value="arrayValueToString(filter.value)"
            placeholder="value1, value2, ..."
            class="flex-1 min-w-[150px]"
            @update:model-value="(v: string) => handleArrayValueChange(filter.id, v)"
          />

          <!-- Date field: date input -->
          <UInput
            v-else-if="getFieldByKey(filter.field)?.type === 'date'"
            :model-value="filter.value as string"
            type="date"
            placeholder="Select date..."
            class="flex-1 min-w-[140px]"
            @update:model-value="handleValueChange(filter.id, $event)"
          />

          <!-- Number field: number input -->
          <UInput
            v-else-if="getFieldByKey(filter.field)?.type === 'number'"
            :model-value="filter.value as number"
            type="number"
            placeholder="Value..."
            class="flex-1 min-w-[100px]"
            @update:model-value="handleValueChange(filter.id, $event)"
          />

          <!-- String/UUID/other field: text input -->
          <UInput
            v-else
            :model-value="filter.value as string"
            placeholder="Value..."
            class="flex-1 min-w-[100px]"
            @update:model-value="handleValueChange(filter.id, $event)"
          />
        </template>

        <!-- Empty placeholder when no value needed -->
        <div v-else-if="!needsValue(filter.operator)" class="flex-1 min-w-[100px]" />

        <!-- Remove button -->
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="ghost"
          size="xs"
          aria-label="Remove filter"
          @click="handleRemoveFilter(filter.id)"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md"
    >
      No filters configured. Add a filter to narrow down results.
    </div>

    <!-- Add filter button -->
    <UButton
      label="Add Filter"
      icon="i-lucide-plus"
      variant="soft"
      size="sm"
      :disabled="availableFields.length === 0"
      @click="handleAddFilter"
    />
  </div>
</template>
