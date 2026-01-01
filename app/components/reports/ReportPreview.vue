<script setup lang="ts">
/**
 * Report Preview Component
 *
 * Displays sample data based on report configuration.
 * Fetches preview data from the custom report API with
 * a limited number of rows (default 10) for quick preview.
 */
import type {
  CustomReportPayload,
  CustomReportResponse,
  FieldDefinition,
  ReportEntityType,
} from '~/composables/useReportBuilder'

interface Props {
  /** Entity type for the report */
  entityType: ReportEntityType
  /** Selected field keys to display */
  fields: string[]
  /** Field definitions for display labels and types */
  fieldDefinitions: FieldDefinition[]
  /** Query payload to execute (optional - will build from props if not provided) */
  queryPayload?: CustomReportPayload
  /** Maximum number of sample rows to fetch */
  sampleSize?: number
  /** Auto-refresh when configuration changes */
  autoRefresh?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  queryPayload: undefined,
  sampleSize: 10,
  autoRefresh: true,
})

// State
const previewData = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const lastRefreshTime = ref<Date | null>(null)

// Build query payload for preview
const effectivePayload = computed<CustomReportPayload>(() => {
  if (props.queryPayload) {
    return {
      ...props.queryPayload,
      pageSize: props.sampleSize,
      page: 1,
    }
  }

  return {
    entityType: props.entityType,
    fields: props.fields,
    pageSize: props.sampleSize,
    page: 1,
  }
})

// Check if configuration is valid for preview
const isValidConfig = computed(() => {
  return props.fields.length > 0
})

// Field labels map for display
const fieldLabels = computed(() => {
  const map = new Map<string, string>()
  for (const field of props.fieldDefinitions) {
    map.set(field.key, field.label)
  }
  return map
})

// Field types map for formatting
const fieldTypes = computed(() => {
  const map = new Map<string, string>()
  for (const field of props.fieldDefinitions) {
    map.set(field.key, field.type)
  }
  return map
})

// Get display columns (visible fields that have definitions)
const displayColumns = computed(() => {
  return props.fields.filter((field) => fieldLabels.value.has(field))
})

// Fetch preview data
async function fetchPreview() {
  if (!isValidConfig.value) {
    error.value = 'Select at least one field to preview data'
    previewData.value = []
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const response = await $fetch<CustomReportResponse>('/api/reports/custom', {
      method: 'POST',
      body: effectivePayload.value,
    })

    previewData.value = response.data || []
    lastRefreshTime.value = new Date()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch preview data'
    error.value = message
    previewData.value = []
    console.error('Preview fetch failed:', err)
  } finally {
    isLoading.value = false
  }
}

// Format cell value based on field type
function formatCellValue(value: unknown, fieldKey: string): string {
  if (value === null || value === undefined) {
    return '-'
  }

  const fieldType = fieldTypes.value.get(fieldKey)

  switch (fieldType) {
    case 'boolean':
      return value ? 'Yes' : 'No'
    case 'date': {
      const date = new Date(value as string)
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
    }
    case 'number':
      if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2)
      }
      return String(value)
    default:
      return String(value)
  }
}

// Get CSS class for cell based on field type
function getCellClass(fieldKey: string): string {
  const fieldType = fieldTypes.value.get(fieldKey)

  switch (fieldType) {
    case 'number':
      return 'text-right tabular-nums'
    case 'boolean':
      return 'text-center'
    default:
      return ''
  }
}

// Manual refresh
function refresh() {
  fetchPreview()
}

// Watch for configuration changes and auto-refresh
watch(
  () => [props.entityType, props.fields, props.queryPayload],
  () => {
    if (props.autoRefresh && isValidConfig.value) {
      fetchPreview()
    }
  },
  { deep: true },
)

// Initial fetch on mount
onMounted(() => {
  if (isValidConfig.value) {
    fetchPreview()
  }
})

// Expose refresh method
defineExpose({ refresh })
</script>

<template>
  <div class="report-preview">
    <!-- Header with refresh button -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-table" class="size-4 text-muted" />
        <h4 class="text-sm font-medium text-highlighted">Preview</h4>
        <UBadge v-if="previewData.length > 0" color="info" size="xs">
          {{ previewData.length }} row{{ previewData.length !== 1 ? 's' : '' }}
        </UBadge>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="lastRefreshTime" class="text-xs text-muted">
          Updated {{ lastRefreshTime.toLocaleTimeString() }}
        </span>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :loading="isLoading"
          :disabled="!isValidConfig"
          aria-label="Refresh preview"
          @click="refresh"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex items-center justify-center py-12 border border-default rounded-lg bg-elevated/30"
      role="status"
      aria-label="Loading preview data"
    >
      <div class="flex flex-col items-center gap-2">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        <span class="text-sm text-muted">Loading preview...</span>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex items-center justify-center py-8 border border-error/30 rounded-lg bg-error/5"
      role="alert"
    >
      <div class="flex flex-col items-center gap-2 text-center px-4">
        <UIcon name="i-lucide-alert-circle" class="size-6 text-error" />
        <span class="text-sm text-error">{{ error }}</span>
        <UButton
          v-if="isValidConfig"
          label="Retry"
          icon="i-lucide-refresh-cw"
          color="error"
          variant="soft"
          size="xs"
          @click="refresh"
        />
      </div>
    </div>

    <!-- Empty state (no fields selected) -->
    <div
      v-else-if="!isValidConfig"
      class="flex flex-col items-center justify-center py-12 border border-dashed border-default rounded-lg"
    >
      <UIcon name="i-lucide-columns-3" class="size-8 text-muted opacity-50 mb-2" />
      <p class="text-sm text-muted">Select fields to preview data</p>
      <p class="text-xs text-muted mt-1">Choose columns from the field selector above</p>
    </div>

    <!-- Empty data state -->
    <div
      v-else-if="previewData.length === 0"
      class="flex flex-col items-center justify-center py-12 border border-default rounded-lg bg-elevated/30"
    >
      <UIcon name="i-lucide-database" class="size-8 text-muted opacity-50 mb-2" />
      <p class="text-sm text-muted">No data found</p>
      <p class="text-xs text-muted mt-1">
        Try adjusting your filters or date range
      </p>
    </div>

    <!-- Data table -->
    <div
      v-else
      class="overflow-x-auto border border-default rounded-lg"
    >
      <table class="w-full text-sm" role="grid" aria-label="Report preview data">
        <thead class="bg-elevated/50">
          <tr>
            <th
              v-for="fieldKey in displayColumns"
              :key="fieldKey"
              class="px-4 py-3 text-left text-xs font-medium text-highlighted uppercase tracking-wider whitespace-nowrap"
              :class="getCellClass(fieldKey)"
              scope="col"
            >
              {{ fieldLabels.get(fieldKey) || fieldKey }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(row, index) in previewData"
            :key="index"
            class="hover:bg-elevated/30 transition-colors"
          >
            <td
              v-for="fieldKey in displayColumns"
              :key="fieldKey"
              class="px-4 py-3 whitespace-nowrap text-muted"
              :class="getCellClass(fieldKey)"
            >
              {{ formatCellValue(row[fieldKey], fieldKey) }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Sample size indicator -->
      <div class="px-4 py-2 bg-elevated/30 border-t border-default text-xs text-muted text-center">
        Showing up to {{ sampleSize }} sample rows.
        <span class="text-highlighted">Run the full report for complete results.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-preview table {
  border-collapse: collapse;
}

.report-preview td {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
