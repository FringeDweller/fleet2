<script setup lang="ts">
/**
 * Data Export Admin Page (US-17.7)
 *
 * Provides interface for exporting data to CSV/Excel with filtering.
 */

definePageMeta({
  middleware: 'auth',
})

// Types for export configuration
interface ExportColumn {
  field: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean'
  description?: string
  enabled: boolean
}

interface ExportFilter {
  id: string
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in'
  value: string
}

interface ScheduledExport {
  id: string
  name: string
  description: string | null
  entity: string
  format: 'csv' | 'xlsx'
  columns: { field: string; label: string; enabled: boolean }[]
  filters: { field: string; operator: string; value: string | number | boolean }[]
  frequency: 'daily' | 'weekly' | 'monthly'
  scheduleDay: string | null
  scheduleTime: string
  emailRecipients: string[]
  isActive: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  createdBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

const toast = useToast()

// Entity types for export
const entityTypes = [
  { value: 'assets', label: 'Assets' },
  { value: 'work_orders', label: 'Work Orders' },
  { value: 'parts', label: 'Parts Inventory' },
  { value: 'inspections', label: 'Inspections' },
  { value: 'fuel_transactions', label: 'Fuel Transactions' },
]

// Export format options
const formatOptions = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLS)' },
]

// Filter operator options
const operatorOptions = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'like', label: 'Contains' },
]

// Frequency options for scheduled exports
const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

// Day of week options
const dayOfWeekOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

// Day of month options (1-28)
const dayOfMonthOptions = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

// State
const selectedEntity = ref('assets')
const selectedFormat = ref<'csv' | 'xlsx'>('csv')
const columns = ref<ExportColumn[]>([])
const filters = ref<ExportFilter[]>([])
const sortField = ref('')
const sortDirection = ref<'asc' | 'desc'>('asc')
const isExporting = ref(false)
const isLoadingColumns = ref(false)

// Scheduled exports modal
const showScheduleModal = ref(false)
const isCreatingSchedule = ref(false)
const scheduleForm = ref({
  name: '',
  description: '',
  frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
  scheduleDay: '1',
  scheduleTime: '06:00',
  emailRecipients: '',
})

// Fetch scheduled exports
const {
  data: scheduledExports,
  status: scheduledExportsStatus,
  refresh: refreshScheduledExports,
} = await useFetch<ScheduledExport[]>('/api/admin/export/scheduled', {
  lazy: true,
})

// Fetch columns when entity changes
watch(
  selectedEntity,
  async () => {
    isLoadingColumns.value = true
    try {
      const response = await $fetch<{ entity: string; columns: ExportColumn[] }>(
        `/api/admin/export/columns/${selectedEntity.value}`,
      )
      columns.value = response.columns.map((c) => ({ ...c, enabled: true }))
      sortField.value = ''
      filters.value = []
    } catch (error) {
      console.error('Failed to load columns:', error)
      toast.add({
        title: 'Error',
        description: 'Failed to load export columns',
        color: 'error',
      })
    } finally {
      isLoadingColumns.value = false
    }
  },
  { immediate: true },
)

// Get enabled columns for the select/filter dropdowns
const enabledColumns = computed(() => columns.value.filter((c) => c.enabled))

// Add a new filter
function addFilter() {
  const firstColumn = columns.value[0]?.field || ''
  filters.value.push({
    id: crypto.randomUUID(),
    field: firstColumn,
    operator: 'eq',
    value: '',
  })
}

// Remove a filter
function removeFilter(id: string) {
  filters.value = filters.value.filter((f) => f.id !== id)
}

// Toggle all columns
function toggleAllColumns(enabled: boolean) {
  columns.value = columns.value.map((c) => ({ ...c, enabled }))
}

// Export data
async function exportData() {
  const enabledCols = columns.value.filter((c) => c.enabled)
  if (enabledCols.length === 0) {
    toast.add({
      title: 'No Columns Selected',
      description: 'Please select at least one column to export',
      color: 'warning',
    })
    return
  }

  isExporting.value = true

  try {
    // Build query parameters
    const params = new URLSearchParams()
    params.set('format', selectedFormat.value)
    params.set('columns', enabledCols.map((c) => c.field).join(','))

    if (sortField.value) {
      params.set('sort', sortField.value)
      params.set('sortDir', sortDirection.value)
    }

    // Add filters if any
    const activeFilters = filters.value.filter((f) => f.value !== '')
    if (activeFilters.length > 0) {
      params.set(
        'filters',
        JSON.stringify(
          activeFilters.map((f) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
        ),
      )
    }

    // Trigger download
    const url = `/api/admin/export/${selectedEntity.value}?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Export failed')
    }

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `${selectedEntity.value}-export.${selectedFormat.value === 'xlsx' ? 'xls' : 'csv'}`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/)
      if (match?.[1]) {
        filename = match[1]
      }
    }

    // Create blob and download
    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    toast.add({
      title: 'Export Complete',
      description: 'Your data has been exported successfully',
      color: 'success',
    })
  } catch (error) {
    console.error('Export failed:', error)
    toast.add({
      title: 'Export Failed',
      description: 'Failed to export data. Please try again.',
      color: 'error',
    })
  } finally {
    isExporting.value = false
  }
}

// Create scheduled export
async function createScheduledExport() {
  const enabledCols = columns.value.filter((c) => c.enabled)
  if (enabledCols.length === 0) {
    toast.add({
      title: 'No Columns Selected',
      description: 'Please select at least one column for the scheduled export',
      color: 'warning',
    })
    return
  }

  if (!scheduleForm.value.name.trim()) {
    toast.add({
      title: 'Name Required',
      description: 'Please enter a name for the scheduled export',
      color: 'warning',
    })
    return
  }

  isCreatingSchedule.value = true

  try {
    // Parse email recipients
    const recipients = scheduleForm.value.emailRecipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    // Prepare filters
    const activeFilters = filters.value
      .filter((f) => f.value !== '')
      .map((f) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      }))

    await $fetch('/api/admin/export/scheduled', {
      method: 'POST',
      body: {
        name: scheduleForm.value.name,
        description: scheduleForm.value.description || undefined,
        entity: selectedEntity.value,
        format: selectedFormat.value,
        columns: enabledCols.map((c) => ({
          field: c.field,
          label: c.label,
          enabled: true,
        })),
        filters: activeFilters,
        sortField: sortField.value || undefined,
        sortDirection: sortDirection.value,
        frequency: scheduleForm.value.frequency,
        scheduleDay: scheduleForm.value.scheduleDay,
        scheduleTime: scheduleForm.value.scheduleTime,
        emailRecipients: recipients,
        isActive: true,
      },
    })

    toast.add({
      title: 'Scheduled Export Created',
      description: `Export "${scheduleForm.value.name}" has been scheduled`,
      color: 'success',
    })

    showScheduleModal.value = false
    scheduleForm.value = {
      name: '',
      description: '',
      frequency: 'weekly',
      scheduleDay: '1',
      scheduleTime: '06:00',
      emailRecipients: '',
    }

    await refreshScheduledExports()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to create scheduled export',
      color: 'error',
    })
  } finally {
    isCreatingSchedule.value = false
  }
}

// Delete scheduled export
async function deleteScheduledExport(exportItem: ScheduledExport) {
  if (!confirm(`Are you sure you want to delete "${exportItem.name}"?`)) {
    return
  }

  try {
    await $fetch(`/api/admin/export/scheduled/${exportItem.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Deleted',
      description: 'Scheduled export has been deleted',
      color: 'success',
    })

    await refreshScheduledExports()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to delete scheduled export',
      color: 'error',
    })
  }
}

// Toggle scheduled export active status
async function toggleScheduledExport(exportItem: ScheduledExport) {
  try {
    await $fetch(`/api/admin/export/scheduled/${exportItem.id}`, {
      method: 'PUT',
      body: {
        isActive: !exportItem.isActive,
      },
    })

    toast.add({
      title: exportItem.isActive ? 'Paused' : 'Activated',
      description: `Scheduled export has been ${exportItem.isActive ? 'paused' : 'activated'}`,
      color: 'success',
    })

    await refreshScheduledExports()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to update scheduled export',
      color: 'error',
    })
  }
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

// Get frequency label
function getFrequencyLabel(exportItem: ScheduledExport): string {
  switch (exportItem.frequency) {
    case 'daily':
      return `Daily at ${exportItem.scheduleTime}`
    case 'weekly': {
      const dayName =
        dayOfWeekOptions.find((d) => d.value === exportItem.scheduleDay)?.label || 'Unknown'
      return `Weekly on ${dayName} at ${exportItem.scheduleTime}`
    }
    case 'monthly':
      return `Monthly on day ${exportItem.scheduleDay} at ${exportItem.scheduleTime}`
    default:
      return 'Unknown'
  }
}
</script>

<template>
  <UDashboardPanel id="data-export">
    <template #header>
      <UDashboardNavbar title="Data Export">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/settings"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-5xl mx-auto py-6 px-4 space-y-8">
        <!-- Export Configuration Section -->
        <section>
          <h2 class="text-xl font-semibold mb-4">Export Data</h2>

          <!-- Entity and Format Selection -->
          <UPageCard variant="subtle" class="mb-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Entity Type">
                <USelect
                  v-model="selectedEntity"
                  :items="entityTypes"
                  value-key="value"
                />
              </UFormField>

              <UFormField label="Export Format">
                <USelect
                  v-model="selectedFormat"
                  :items="formatOptions"
                  value-key="value"
                />
              </UFormField>
            </div>
          </UPageCard>

          <!-- Column Selection -->
          <UPageCard
            title="Columns"
            description="Select which columns to include in the export"
            variant="naked"
            class="mb-2"
          >
            <template #trailing>
              <div class="flex gap-2">
                <UButton
                  variant="ghost"
                  size="xs"
                  @click="toggleAllColumns(true)"
                >
                  Select All
                </UButton>
                <UButton
                  variant="ghost"
                  size="xs"
                  @click="toggleAllColumns(false)"
                >
                  Deselect All
                </UButton>
              </div>
            </template>
          </UPageCard>

          <UPageCard variant="subtle" class="mb-4">
            <div v-if="isLoadingColumns" class="flex justify-center py-4">
              <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <label
                v-for="column in columns"
                :key="column.field"
                class="flex items-center gap-2 p-2 rounded hover:bg-default-100 cursor-pointer"
              >
                <input
                  v-model="column.enabled"
                  type="checkbox"
                  class="rounded border-default-300"
                />
                <span class="text-sm">{{ column.label }}</span>
              </label>
            </div>
          </UPageCard>

          <!-- Filters -->
          <UPageCard
            title="Filters"
            description="Optionally filter the data before export"
            variant="naked"
            class="mb-2"
          >
            <template #trailing>
              <UButton
                icon="i-lucide-plus"
                variant="ghost"
                size="xs"
                @click="addFilter"
              >
                Add Filter
              </UButton>
            </template>
          </UPageCard>

          <UPageCard variant="subtle" class="mb-4">
            <div v-if="filters.length === 0" class="text-muted text-sm py-2">
              No filters applied. All records will be exported.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="filter in filters"
                :key="filter.id"
                class="flex items-center gap-2"
              >
                <USelect
                  v-model="filter.field"
                  :items="columns.map((c) => ({ value: c.field, label: c.label }))"
                  value-key="value"
                  class="w-48"
                />
                <USelect
                  v-model="filter.operator"
                  :items="operatorOptions"
                  value-key="value"
                  class="w-36"
                />
                <UInput
                  v-model="filter.value"
                  placeholder="Value"
                  class="flex-1"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="removeFilter(filter.id)"
                />
              </div>
            </div>
          </UPageCard>

          <!-- Sort -->
          <UPageCard
            title="Sort"
            description="Optionally sort the exported data"
            variant="naked"
            class="mb-2"
          />

          <UPageCard variant="subtle" class="mb-6">
            <div class="flex items-center gap-4">
              <UFormField label="Sort By" class="flex-1">
                <USelect
                  v-model="sortField"
                  :items="[{ value: '', label: 'Default' }, ...enabledColumns.map((c) => ({ value: c.field, label: c.label }))]"
                  value-key="value"
                />
              </UFormField>
              <UFormField label="Direction">
                <USelect
                  v-model="sortDirection"
                  :items="[
                    { value: 'asc', label: 'Ascending' },
                    { value: 'desc', label: 'Descending' },
                  ]"
                  value-key="value"
                  :disabled="!sortField"
                />
              </UFormField>
            </div>
          </UPageCard>

          <!-- Export Actions -->
          <div class="flex justify-end gap-3">
            <UButton
              variant="outline"
              @click="showScheduleModal = true"
            >
              Schedule Export
            </UButton>
            <UButton
              color="primary"
              :loading="isExporting"
              @click="exportData"
            >
              Export Now
            </UButton>
          </div>
        </section>

        <!-- Scheduled Exports Section -->
        <section>
          <h2 class="text-xl font-semibold mb-4">Scheduled Exports</h2>

          <div v-if="scheduledExportsStatus === 'pending'" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
          </div>

          <div v-else-if="!scheduledExports?.length" class="text-center py-8 text-muted">
            <UIcon name="i-lucide-calendar-clock" class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No scheduled exports configured</p>
          </div>

          <div v-else class="space-y-3">
            <UPageCard
              v-for="exportItem in scheduledExports"
              :key="exportItem.id"
              variant="subtle"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-medium">{{ exportItem.name }}</h3>
                    <UBadge
                      :color="exportItem.isActive ? 'success' : 'neutral'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ exportItem.isActive ? 'Active' : 'Paused' }}
                    </UBadge>
                  </div>
                  <p v-if="exportItem.description" class="text-sm text-muted mt-1">
                    {{ exportItem.description }}
                  </p>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted">
                    <span>
                      <strong>Entity:</strong> {{ entityTypes.find((e) => e.value === exportItem.entity)?.label }}
                    </span>
                    <span>
                      <strong>Format:</strong> {{ exportItem.format.toUpperCase() }}
                    </span>
                    <span>
                      <strong>Schedule:</strong> {{ getFrequencyLabel(exportItem) }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted">
                    <span v-if="exportItem.lastRunAt">
                      <strong>Last Run:</strong> {{ formatDate(exportItem.lastRunAt) }}
                    </span>
                    <span v-if="exportItem.nextRunAt">
                      <strong>Next Run:</strong> {{ formatDate(exportItem.nextRunAt) }}
                    </span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <UButton
                    :icon="exportItem.isActive ? 'i-lucide-pause' : 'i-lucide-play'"
                    variant="ghost"
                    size="xs"
                    :title="exportItem.isActive ? 'Pause' : 'Resume'"
                    @click="toggleScheduledExport(exportItem)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    title="Delete"
                    @click="deleteScheduledExport(exportItem)"
                  />
                </div>
              </div>
            </UPageCard>
          </div>
        </section>
      </div>
    </template>

    <!-- Schedule Modal -->
    <UModal v-model:open="showScheduleModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">Schedule Export</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="showScheduleModal = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Name" required>
              <UInput
                v-model="scheduleForm.name"
                placeholder="Weekly Assets Report"
              />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="scheduleForm.description"
                placeholder="Optional description..."
                :rows="2"
              />
            </UFormField>

            <UFormField label="Frequency">
              <USelect
                v-model="scheduleForm.frequency"
                :items="frequencyOptions"
                value-key="value"
              />
            </UFormField>

            <UFormField
              v-if="scheduleForm.frequency === 'weekly'"
              label="Day of Week"
            >
              <USelect
                v-model="scheduleForm.scheduleDay"
                :items="dayOfWeekOptions"
                value-key="value"
              />
            </UFormField>

            <UFormField
              v-if="scheduleForm.frequency === 'monthly'"
              label="Day of Month"
            >
              <USelect
                v-model="scheduleForm.scheduleDay"
                :items="dayOfMonthOptions"
                value-key="value"
              />
            </UFormField>

            <UFormField label="Time (24h)">
              <UInput
                v-model="scheduleForm.scheduleTime"
                type="time"
              />
            </UFormField>

            <UFormField
              label="Email Recipients"
              description="Comma-separated email addresses"
            >
              <UInput
                v-model="scheduleForm.emailRecipients"
                placeholder="user@example.com, another@example.com"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                variant="outline"
                @click="showScheduleModal = false"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                :loading="isCreatingSchedule"
                @click="createScheduledExport"
              >
                Create Schedule
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
