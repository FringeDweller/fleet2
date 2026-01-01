<script setup lang="ts">
/**
 * Report Builder Page
 *
 * Wires together the report builder components:
 * - FieldSelector: Select/reorder columns
 * - FilterBuilder: Add/manage filters
 * - GroupingSelector: Configure grouping and aggregations
 * - ReportPreview: Live preview of report data
 *
 * Uses useReportBuilder composable for state management.
 */
import type { ReportEntityType, ReportFilter } from '~/composables/useReportBuilder'

definePageMeta({
  middleware: 'auth',
})

// Initialize the report builder composable
const {
  // State
  entityType,
  selectedFields,
  filters,
  groupByFields,
  aggregations,
  isLoading,
  error,

  // Computed
  availableFields,
  entityTypeLabel,
  numericFields,
  isValid,

  // Entity type methods
  setEntityType,

  // Field methods
  addField,
  removeField,
  reorderFields,

  // Filter methods
  addFilter,
  updateFilter,
  removeFilter,
  clearFilters,

  // GroupBy methods
  addGroupByField,
  removeGroupByField,
  clearGroupBy,

  // Aggregation methods
  addAggregation,
  updateAggregation,
  removeAggregation,
  clearAggregations,

  // Query methods
  buildQueryPayload,
  executeReport,

  // Reset
  resetBuilder,

  // Static data
  ENTITY_LABELS,
} = useReportBuilder()

const toast = useToast()

// Convert readonly filters to mutable for component props
function convertFilterValue(
  value: string | number | boolean | readonly string[] | readonly number[] | null | undefined,
): ReportFilter['value'] {
  if (Array.isArray(value)) {
    // Create a new mutable array from readonly array
    return [...value] as string[] | number[]
  }
  // Non-array values can be returned directly (primitives are not affected by readonly)
  return value as string | number | boolean | null | undefined
}

const mutableFilters = computed<ReportFilter[]>(() => {
  return filters.value.map(
    (f): ReportFilter => ({
      id: f.id,
      field: f.field,
      operator: f.operator,
      value: convertFilterValue(f.value),
    }),
  )
})

// Entity type options for the select
const entityTypeOptions = computed(() => {
  return Object.entries(ENTITY_LABELS).map(([value, label]) => ({
    label,
    value,
  }))
})

// Track which panel is expanded (for mobile accordion view)
const expandedPanel = ref<'fields' | 'filters' | 'grouping' | 'preview'>('fields')

// Preview component ref for manual refresh
const previewRef = ref<{ refresh: () => void } | null>(null)

// Export state
const isExporting = ref(false)
const exportFormat = ref<'csv' | 'pdf' | 'excel'>('csv')

// Handle entity type change
function handleEntityTypeChange(type: string) {
  if (type && Object.keys(ENTITY_LABELS).includes(type)) {
    setEntityType(type as ReportEntityType)
  }
}

// Execute and export report
async function handleExport(format: 'csv' | 'pdf' | 'excel') {
  if (!isValid.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Please select at least one field before exporting.',
      color: 'warning',
    })
    return
  }

  isExporting.value = true
  exportFormat.value = format

  try {
    const result = await executeReport()

    if (!result || !result.data.length) {
      toast.add({
        title: 'No Data',
        description: 'No data available to export.',
        color: 'warning',
      })
      return
    }

    if (format === 'csv') {
      exportToCSV(result.data, result.fields)
    } else if (format === 'excel') {
      exportToExcel(result.data, result.fields)
    } else if (format === 'pdf') {
      await exportToPDF(result.data, result.fields)
    }

    toast.add({
      title: 'Export Complete',
      description: `Report exported as ${format.toUpperCase()}`,
      color: 'success',
    })
  } catch (err) {
    console.error('Export failed:', err)
    toast.add({
      title: 'Export Failed',
      description: err instanceof Error ? err.message : 'Failed to export report',
      color: 'error',
    })
  } finally {
    isExporting.value = false
  }
}

// Export to CSV
function exportToCSV(
  data: Record<string, unknown>[],
  fields: Array<{ field: string; type: string }>,
) {
  const headers = fields.map((f) => f.field)
  const rows = data.map((row) =>
    headers.map((header) => {
      const val = row[header]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }),
  )

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  downloadFile(csvContent, 'text/csv;charset=utf-8;', 'csv')
}

// Export to Excel (CSV with Excel-compatible encoding)
function exportToExcel(
  data: Record<string, unknown>[],
  fields: Array<{ field: string; type: string }>,
) {
  const headers = fields.map((f) => f.field)
  const rows = data.map((row) =>
    headers.map((header) => {
      const val = row[header]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }),
  )

  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF'
  const csvContent =
    BOM +
    [
      headers.join('\t'),
      ...rows.map((row) => row.map((cell) => cell.replace(/\t/g, ' ')).join('\t')),
    ].join('\n')

  downloadFile(csvContent, 'application/vnd.ms-excel;charset=utf-8;', 'xls')
}

// Export to PDF (basic implementation)
async function exportToPDF(
  data: Record<string, unknown>[],
  fields: Array<{ field: string; type: string }>,
) {
  // For PDF, we will create a printable HTML and trigger print
  const headers = fields.map((f) => f.field)

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${entityTypeLabel.value} Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background-color: #fafafa; }
        .footer { margin-top: 20px; font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <h1>${entityTypeLabel.value} Report</h1>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data
            .map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? '-'}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
      <div class="footer">
        Generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.print()
  }
}

// Helper to download file
function downloadFile(content: string, mimeType: string, extension: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${entityTypeLabel.value.toLowerCase().replace(/\s+/g, '-')}-report-${new Date().toISOString().split('T')[0]}.${extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Refresh preview
function refreshPreview() {
  previewRef.value?.refresh()
}
</script>

<template>
  <UDashboardPanel id="report-builder">
    <template #header>
      <UDashboardNavbar title="Report Builder">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/reports" />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Reset"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="resetBuilder"
            />
            <UDropdownMenu>
              <UButton
                label="Export"
                icon="i-lucide-download"
                :loading="isExporting"
                :disabled="!isValid"
              />
              <template #content>
                <UDropdownMenuItem
                  icon="i-lucide-file-text"
                  label="Export as CSV"
                  @click="handleExport('csv')"
                />
                <UDropdownMenuItem
                  icon="i-lucide-file-spreadsheet"
                  label="Export as Excel"
                  @click="handleExport('excel')"
                />
                <UDropdownMenuItem
                  icon="i-lucide-file-type"
                  label="Export as PDF"
                  @click="handleExport('pdf')"
                />
              </template>
            </UDropdownMenu>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-7xl mx-auto space-y-6">
        <!-- Entity Type Selector -->
        <UCard>
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-database" class="size-5" />
              <span>Data Source</span>
            </div>
            <USelect
              :model-value="entityType"
              :items="entityTypeOptions"
              placeholder="Select entity type..."
              class="flex-1 max-w-xs"
              @update:model-value="handleEntityTypeChange"
            />
            <p class="text-sm text-muted">
              Select the type of data you want to report on.
            </p>
          </div>
        </UCard>

        <!-- Error Alert -->
        <UAlert
          v-if="error"
          color="error"
          icon="i-lucide-alert-circle"
          :title="error"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'ghost' }"
          @close="error = null"
        />

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Left Column: Configuration -->
          <div class="space-y-6">
            <!-- Field Selector -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-base font-semibold text-highlighted flex items-center gap-2">
                    <UIcon name="i-lucide-columns-3" class="size-5" />
                    Columns
                  </h3>
                  <UBadge v-if="selectedFields.length > 0" color="primary" size="sm">
                    {{ selectedFields.length }} selected
                  </UBadge>
                </div>
              </template>
              <ReportsFieldSelector
                :available-fields="availableFields"
                :selected-fields="[...selectedFields]"
                :disabled="isLoading"
                @add-field="addField"
                @remove-field="removeField"
                @reorder-fields="reorderFields"
              />
            </UCard>

            <!-- Filter Builder -->
            <UCard>
              <template #header>
                <h3 class="text-base font-semibold text-highlighted flex items-center gap-2">
                  <UIcon name="i-lucide-filter" class="size-5" />
                  Filters
                </h3>
              </template>
              <ReportsFilterBuilder
                :filters="mutableFilters"
                :available-fields="availableFields"
                @add="addFilter"
                @update="(id, updates) => updateFilter(id, updates)"
                @remove="removeFilter"
                @clear="clearFilters"
              />
            </UCard>

            <!-- Grouping Selector -->
            <UCard>
              <template #header>
                <h3 class="text-base font-semibold text-highlighted flex items-center gap-2">
                  <UIcon name="i-lucide-layers" class="size-5" />
                  Grouping & Aggregations
                </h3>
              </template>
              <ReportsGroupingSelector
                :group-by-fields="[...groupByFields]"
                :aggregations="[...aggregations]"
                :available-fields="availableFields"
                :numeric-fields="numericFields"
                :disabled="isLoading"
                @add-group-by="addGroupByField"
                @remove-group-by="removeGroupByField"
                @clear-group-by="clearGroupBy"
                @add-aggregation="addAggregation"
                @update-aggregation="(id, updates) => updateAggregation(id, updates)"
                @remove-aggregation="removeAggregation"
                @clear-aggregations="clearAggregations"
              />
            </UCard>
          </div>

          <!-- Right Column: Preview -->
          <div class="lg:sticky lg:top-4 lg:self-start">
            <UCard class="h-full">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-base font-semibold text-highlighted flex items-center gap-2">
                    <UIcon name="i-lucide-eye" class="size-5" />
                    Live Preview
                  </h3>
                  <UButton
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :loading="isLoading"
                    :disabled="!isValid"
                    aria-label="Refresh preview"
                    @click="refreshPreview"
                  />
                </div>
              </template>
              <ReportsReportPreview
                ref="previewRef"
                :entity-type="entityType"
                :fields="[...selectedFields]"
                :field-definitions="availableFields"
                :query-payload="buildQueryPayload()"
                :sample-size="10"
                :auto-refresh="true"
              />
            </UCard>
          </div>
        </div>

        <!-- Export Section (visible on mobile) -->
        <div class="lg:hidden">
          <UCard>
            <template #header>
              <h3 class="text-base font-semibold text-highlighted flex items-center gap-2">
                <UIcon name="i-lucide-download" class="size-5" />
                Export Report
              </h3>
            </template>
            <div class="flex flex-wrap gap-3">
              <UButton
                label="Export CSV"
                icon="i-lucide-file-text"
                variant="soft"
                :loading="isExporting && exportFormat === 'csv'"
                :disabled="!isValid"
                @click="handleExport('csv')"
              />
              <UButton
                label="Export Excel"
                icon="i-lucide-file-spreadsheet"
                variant="soft"
                :loading="isExporting && exportFormat === 'excel'"
                :disabled="!isValid"
                @click="handleExport('excel')"
              />
              <UButton
                label="Export PDF"
                icon="i-lucide-file-type"
                variant="soft"
                :loading="isExporting && exportFormat === 'pdf'"
                :disabled="!isValid"
                @click="handleExport('pdf')"
              />
            </div>
            <p class="mt-3 text-xs text-muted">
              Configure your report using the options above, then export to your preferred format.
            </p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
