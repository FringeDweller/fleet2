<script setup lang="ts">
/**
 * Grouping Selector Component for Report Builder
 *
 * Allows users to select fields to group by and configure
 * aggregation functions (count, sum, avg, min, max) with
 * corresponding aggregation fields.
 */
import type {
  AggregationType,
  FieldDefinition,
  ReportAggregation,
} from '~/composables/useReportBuilder'

interface Props {
  /** Currently selected group by field keys */
  groupByFields: string[]
  /** Configured aggregations */
  aggregations: ReportAggregation[]
  /** All available fields for the current entity type */
  availableFields: FieldDefinition[]
  /** Numeric fields only (for sum, avg, min, max) */
  numericFields: FieldDefinition[]
  /** Disable interaction */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'add-group-by': [fieldKey: string]
  'remove-group-by': [fieldKey: string]
  'clear-group-by': []
  'add-aggregation': [aggregation?: Partial<ReportAggregation>]
  'update-aggregation': [id: string, updates: Partial<Omit<ReportAggregation, 'id'>>]
  'remove-aggregation': [id: string]
  'clear-aggregations': []
}>()

// Aggregation type labels for display
const aggregationLabels: Record<AggregationType, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
}

// Aggregation type descriptions
const aggregationDescriptions: Record<AggregationType, string> = {
  count: 'Count the number of records',
  sum: 'Calculate the total sum',
  avg: 'Calculate the average value',
  min: 'Find the minimum value',
  max: 'Find the maximum value',
}

// Aggregation types
const aggregationTypes: AggregationType[] = ['count', 'sum', 'avg', 'min', 'max']

// Computed: fields available for grouping (not already selected)
const availableGroupByFields = computed(() => {
  return props.availableFields.filter((field) => !props.groupByFields.includes(field.key))
})

// Computed: selected group by field definitions
const selectedGroupByDefinitions = computed(() => {
  return props.groupByFields
    .map((key) => props.availableFields.find((f) => f.key === key))
    .filter((f): f is FieldDefinition => f !== undefined)
})

// Field options for group by select
const groupByFieldOptions = computed(() => {
  return availableGroupByFields.value.map((f) => ({
    label: f.label,
    value: f.key,
  }))
})

// Field options for aggregation (count can use any, others need numeric)
function getAggregationFieldOptions(aggregationType: AggregationType) {
  // Count can be performed on any field (typically * or a specific field)
  if (aggregationType === 'count') {
    return [
      { label: 'All Records (*)', value: '*' },
      ...props.availableFields.map((f) => ({
        label: f.label,
        value: f.key,
      })),
    ]
  }
  // sum, avg, min, max require numeric fields
  return props.numericFields.map((f) => ({
    label: f.label,
    value: f.key,
  }))
}

// Aggregation type options
const aggregationTypeOptions = computed(() => {
  return aggregationTypes.map((type) => ({
    label: aggregationLabels[type],
    value: type,
    description: aggregationDescriptions[type],
  }))
})

// Handle adding a group by field
function handleAddGroupByField(fieldKey: string | null) {
  if (!fieldKey || props.disabled) return
  emit('add-group-by', fieldKey)
}

// Handle removing a group by field
function handleRemoveGroupByField(fieldKey: string) {
  if (props.disabled) return
  emit('remove-group-by', fieldKey)
}

// Handle clearing all group by fields
function handleClearGroupBy() {
  if (props.disabled) return
  emit('clear-group-by')
}

// Handle adding a new aggregation
function handleAddAggregation() {
  if (props.disabled) return
  emit('add-aggregation', { type: 'count', field: '*' })
}

// Handle aggregation type change
function handleAggregationTypeChange(id: string, type: AggregationType | null) {
  if (!type || props.disabled) return

  // When switching to count, default to '*'
  // When switching to other types, clear the field if it's not numeric
  const currentAgg = props.aggregations.find((a) => a.id === id)
  let newField = currentAgg?.field

  if (type === 'count' && !newField) {
    newField = '*'
  } else if (type !== 'count') {
    // Check if current field is numeric
    const isNumeric = props.numericFields.some((f) => f.key === currentAgg?.field)
    if (!isNumeric) {
      newField = props.numericFields[0]?.key || ''
    }
  }

  emit('update-aggregation', id, { type, field: newField })
}

// Handle aggregation field change
function handleAggregationFieldChange(id: string, field: string | null) {
  if (!field || props.disabled) return
  emit('update-aggregation', id, { field })
}

// Handle aggregation alias change
function handleAggregationAliasChange(id: string, alias: string) {
  if (props.disabled) return
  emit('update-aggregation', id, { alias: alias || undefined })
}

// Handle removing an aggregation
function handleRemoveAggregation(id: string) {
  if (props.disabled) return
  emit('remove-aggregation', id)
}

// Handle clearing all aggregations
function handleClearAggregations() {
  if (props.disabled) return
  emit('clear-aggregations')
}

// Get display label for an aggregation
function getAggregationLabel(agg: ReportAggregation): string {
  const typeLabel = aggregationLabels[agg.type]
  let fieldLabel = agg.field

  if (agg.field === '*') {
    fieldLabel = 'All Records'
  } else {
    const field = props.availableFields.find((f) => f.key === agg.field)
    if (field) fieldLabel = field.label
  }

  return `${typeLabel} of ${fieldLabel}`
}
</script>

<template>
  <div class="grouping-selector space-y-6">
    <!-- Group By Section -->
    <div class="group-by-section">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-group" class="size-4 text-muted" />
          <h4 class="text-sm font-medium text-highlighted">Group By</h4>
          <UBadge
            v-if="groupByFields.length > 0"
            color="primary"
            variant="subtle"
            size="xs"
          >
            {{ groupByFields.length }}
          </UBadge>
        </div>
        <UButton
          v-if="groupByFields.length > 0"
          label="Clear"
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="disabled"
          @click="handleClearGroupBy"
        />
      </div>

      <!-- Selected Group By Fields -->
      <div v-if="selectedGroupByDefinitions.length > 0" class="mb-3 flex flex-wrap gap-2">
        <UBadge
          v-for="field in selectedGroupByDefinitions"
          :key="field.key"
          color="primary"
          variant="subtle"
          size="md"
          class="flex items-center gap-1"
        >
          <span>{{ field.label }}</span>
          <UButton
            icon="i-lucide-x"
            variant="link"
            color="primary"
            size="xs"
            class="!p-0 !size-4"
            :disabled="disabled"
            aria-label="Remove group by field"
            @click.stop="handleRemoveGroupByField(field.key)"
          />
        </UBadge>
      </div>

      <!-- Add Group By Field Select -->
      <USelect
        v-if="availableGroupByFields.length > 0"
        :model-value="undefined"
        :items="groupByFieldOptions"
        placeholder="Add field to group by..."
        :disabled="disabled"
        class="max-w-xs"
        @update:model-value="handleAddGroupByField"
      />

      <p
        v-else-if="groupByFields.length === 0"
        class="text-sm text-muted py-3 text-center border border-dashed border-default rounded-md"
      >
        No group by fields selected. Select fields to group results.
      </p>
    </div>

    <!-- Aggregations Section -->
    <div class="aggregations-section">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-calculator" class="size-4 text-muted" />
          <h4 class="text-sm font-medium text-highlighted">Aggregations</h4>
          <UBadge
            v-if="aggregations.length > 0"
            color="success"
            variant="subtle"
            size="xs"
          >
            {{ aggregations.length }}
          </UBadge>
        </div>
        <UButton
          v-if="aggregations.length > 0"
          label="Clear All"
          icon="i-lucide-x"
          variant="ghost"
          color="error"
          size="xs"
          :disabled="disabled"
          @click="handleClearAggregations"
        />
      </div>

      <!-- Aggregation List -->
      <div v-if="aggregations.length > 0" class="space-y-2 mb-3">
        <div
          v-for="agg in aggregations"
          :key="agg.id"
          class="flex items-start gap-2 p-3 bg-elevated/30 border border-default rounded-lg"
        >
          <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <!-- Aggregation Type -->
            <div>
              <label class="text-xs text-muted block mb-1">Function</label>
              <USelect
                :model-value="agg.type"
                :items="aggregationTypeOptions"
                placeholder="Select function..."
                :disabled="disabled"
                @update:model-value="handleAggregationTypeChange(agg.id, $event)"
              />
            </div>

            <!-- Aggregation Field -->
            <div>
              <label class="text-xs text-muted block mb-1">Field</label>
              <USelect
                :model-value="agg.field"
                :items="getAggregationFieldOptions(agg.type)"
                placeholder="Select field..."
                :disabled="disabled || (agg.type !== 'count' && numericFields.length === 0)"
                @update:model-value="handleAggregationFieldChange(agg.id, $event)"
              />
              <p
                v-if="agg.type !== 'count' && numericFields.length === 0"
                class="text-xs text-error mt-1"
              >
                No numeric fields available
              </p>
            </div>

            <!-- Aggregation Alias (optional) -->
            <div>
              <label class="text-xs text-muted block mb-1">Alias (optional)</label>
              <UInput
                :model-value="agg.alias || ''"
                placeholder="Column name..."
                :disabled="disabled"
                @update:model-value="handleAggregationAliasChange(agg.id, $event)"
              />
            </div>
          </div>

          <!-- Remove Button -->
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            class="mt-5"
            :disabled="disabled"
            aria-label="Remove aggregation"
            @click="handleRemoveAggregation(agg.id)"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="text-sm text-muted py-4 text-center border border-dashed border-default rounded-md mb-3"
      >
        <UIcon name="i-lucide-calculator" class="size-8 mx-auto mb-2 opacity-50" />
        <p>No aggregations configured.</p>
        <p class="text-xs mt-1">Add aggregations to calculate summary values like count, sum, or average.</p>
      </div>

      <!-- Add Aggregation Button -->
      <UButton
        label="Add Aggregation"
        icon="i-lucide-plus"
        variant="soft"
        size="sm"
        :disabled="disabled"
        @click="handleAddAggregation"
      />

      <!-- Helpful Tip -->
      <div class="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-lightbulb" class="size-4 text-info shrink-0 mt-0.5" />
          <div class="text-xs text-muted">
            <p class="font-medium text-highlighted mb-1">Tips:</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li>Use <strong>Group By</strong> to organize results by one or more fields</li>
              <li><strong>Count</strong> works on any field; <strong>Sum</strong>, <strong>Avg</strong>, <strong>Min</strong>, <strong>Max</strong> require numeric fields</li>
              <li>Add an <strong>Alias</strong> to give aggregated columns custom names</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
