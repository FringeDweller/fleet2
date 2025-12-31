<script setup lang="ts">
/**
 * Custom Report Builder Page (US-14.7)
 *
 * Multi-step report builder:
 * 1. Select data source
 * 2. Choose columns
 * 3. Apply filters
 * 4. Grouping and aggregations (optional)
 * 5. Preview and save/run
 */

definePageMeta({
  middleware: 'auth',
})

// Types
interface DataSourceInfo {
  id: string
  label: string
  description: string
  icon: string
}

interface ColumnInfo {
  field: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'uuid'
  filterable: boolean
  sortable: boolean
  aggregatable?: boolean
  options?: string[]
}

interface FilterOperator {
  value: string
  label: string
}

interface ReportMetadata {
  dataSources: DataSourceInfo[]
  columns: Record<string, ColumnInfo[]>
  filterOperators: Record<string, FilterOperator[]>
  aggregationTypes: { value: string; label: string }[]
}

interface CustomReportFilter {
  field: string
  operator: string
  value: string | number | boolean | string[] | number[] | null
}

interface CustomReportAggregation {
  field: string
  type: 'count' | 'sum' | 'avg' | 'min' | 'max'
  alias?: string
}

// Route params
const route = useRoute()
const router = useRouter()
const toast = useToast()

const reportId = computed(() => route.query.id as string | undefined)
const shouldRun = computed(() => route.query.run === 'true')

// Fetch metadata
const { data: metadata } = await useFetch<ReportMetadata>('/api/reports/custom/metadata', {
  lazy: true,
})

// State
const currentStep = ref(1)
const isLoading = ref(false)
const isSaving = ref(false)
const isRunning = ref(false)

// Report configuration
const reportName = ref('')
const reportDescription = ref('')
const isShared = ref(false)
const selectedDataSource = ref<string | null>(null)
const selectedColumns = ref<Record<string, boolean>>({})
const filters = ref<CustomReportFilter[]>([])
const dateRangeField = ref('')
const dateRangeStart = ref<string>('')
const dateRangeEnd = ref<string>('')
const groupByFields = ref<string[]>([])
const aggregations = ref<CustomReportAggregation[]>([])
const orderByField = ref('')
const orderByDirection = ref<'asc' | 'desc'>('desc')

// Results
const reportResults = ref<{
  data: Record<string, unknown>[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  columns: { field: string; label: string }[]
} | null>(null)
const resultsPage = ref(1)

// Load existing report if editing
async function loadReport() {
  if (!reportId.value) return

  isLoading.value = true
  try {
    const report = await $fetch(`/api/reports/custom/${reportId.value}`)
    if (report) {
      reportName.value = report.name
      reportDescription.value = report.description || ''
      isShared.value = report.isShared
      selectedDataSource.value = report.dataSource

      // Load columns
      const def = report.definition
      selectedColumns.value = {}
      for (const col of def.columns) {
        selectedColumns.value[col.field] = col.visible
      }

      // Load filters
      filters.value = def.filters || []

      // Load date range
      if (def.dateRange) {
        dateRangeField.value = def.dateRange.field
        dateRangeStart.value = def.dateRange.startDate || ''
        dateRangeEnd.value = def.dateRange.endDate || ''
      }

      // Load groupBy
      groupByFields.value = def.groupBy || []

      // Load aggregations
      aggregations.value = def.aggregations || []

      // Load orderBy
      if (def.orderBy) {
        orderByField.value = def.orderBy.field
        orderByDirection.value = def.orderBy.direction
      }

      // Go to preview step
      currentStep.value = 5

      // Auto-run if requested
      if (shouldRun.value) {
        await runReport()
      }
    }
  } catch (error) {
    console.error('Failed to load report:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to load report',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadReport()
})

// Computed
const availableColumns = computed<ColumnInfo[]>(() => {
  if (!selectedDataSource.value || !metadata.value?.columns) return []
  return metadata.value.columns[selectedDataSource.value] || []
})

const filterableColumns = computed<ColumnInfo[]>(() => {
  return availableColumns.value.filter((c) => c.filterable)
})

const aggregatableColumns = computed<ColumnInfo[]>(() => {
  return availableColumns.value.filter((c) => c.aggregatable || c.type === 'number')
})

const sortableColumns = computed<ColumnInfo[]>(() => {
  return availableColumns.value.filter((c) => c.sortable)
})

const dateColumns = computed<ColumnInfo[]>(() => {
  return availableColumns.value.filter((c) => c.type === 'date')
})

const selectedColumnCount = computed(() => {
  return Object.values(selectedColumns.value).filter(Boolean).length
})

const canProceedStep1 = computed(() => !!selectedDataSource.value)
const canProceedStep2 = computed(() => selectedColumnCount.value > 0)
const canProceedStep3 = computed(() => true) // Filters are optional
const canProceedStep4 = computed(() => true) // Grouping is optional

// Methods
function selectDataSource(source: string) {
  if (selectedDataSource.value !== source) {
    selectedDataSource.value = source
    // Reset columns when changing data source
    selectedColumns.value = {}
    filters.value = []
    groupByFields.value = []
    aggregations.value = []
    dateRangeField.value = ''
    orderByField.value = ''
    reportResults.value = null
  }
}

function toggleColumn(field: string) {
  selectedColumns.value[field] = !selectedColumns.value[field]
}

function selectAllColumns() {
  for (const col of availableColumns.value) {
    selectedColumns.value[col.field] = true
  }
}

function clearAllColumns() {
  selectedColumns.value = {}
}

function addFilter() {
  if (filterableColumns.value.length === 0) return
  filters.value.push({
    field: filterableColumns.value[0].field,
    operator: 'eq',
    value: '',
  })
}

function removeFilter(index: number) {
  filters.value.splice(index, 1)
}

function getFilterOperators(fieldName: string): FilterOperator[] {
  const col = filterableColumns.value.find((c) => c.field === fieldName)
  if (!col || !metadata.value?.filterOperators) return []
  return metadata.value.filterOperators[col.type] || []
}

function getFilterColumnOptions(fieldName: string): string[] {
  const col = filterableColumns.value.find((c) => c.field === fieldName)
  return col?.options || []
}

function addAggregation() {
  if (aggregatableColumns.value.length === 0) return
  aggregations.value.push({
    field: aggregatableColumns.value[0].field,
    type: 'sum',
  })
}

function removeAggregation(index: number) {
  aggregations.value.splice(index, 1)
}

function toggleGroupBy(field: string) {
  const index = groupByFields.value.indexOf(field)
  if (index === -1) {
    groupByFields.value.push(field)
  } else {
    groupByFields.value.splice(index, 1)
  }
}

function buildDefinition() {
  const visibleCols = Object.entries(selectedColumns.value)
    .filter(([, visible]) => visible)
    .map(([field], index) => ({
      field,
      label: availableColumns.value.find((c) => c.field === field)?.label || field,
      visible: true,
      order: index,
    }))

  const definition: Record<string, unknown> = {
    columns: visibleCols,
    filters: filters.value.filter((f) => {
      // Only include filters with values (except isNull/isNotNull which don't need values)
      if (f.operator === 'isNull' || f.operator === 'isNotNull') return true
      return f.value !== '' && f.value !== null && f.value !== undefined
    }),
  }

  if (dateRangeField.value && (dateRangeStart.value || dateRangeEnd.value)) {
    definition.dateRange = {
      field: dateRangeField.value,
      startDate: dateRangeStart.value || undefined,
      endDate: dateRangeEnd.value || undefined,
    }
  }

  if (groupByFields.value.length > 0) {
    definition.groupBy = groupByFields.value
  }

  if (aggregations.value.length > 0) {
    definition.aggregations = aggregations.value
  }

  if (orderByField.value) {
    definition.orderBy = {
      field: orderByField.value,
      direction: orderByDirection.value,
    }
  }

  return definition
}

async function runReport(page = 1) {
  if (!selectedDataSource.value) return

  isRunning.value = true
  resultsPage.value = page

  try {
    const result = await $fetch('/api/reports/custom/execute', {
      method: 'POST',
      body: {
        dataSource: selectedDataSource.value,
        definition: buildDefinition(),
        page,
        pageSize: 50,
        reportId: reportId.value,
      },
    })

    reportResults.value = result
  } catch (error: unknown) {
    console.error('Failed to run report:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'data' in error
          ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage)
          : 'Failed to execute report'
    toast.add({
      title: 'Error',
      description: errorMessage,
      color: 'error',
    })
  } finally {
    isRunning.value = false
  }
}

async function saveReport() {
  if (!selectedDataSource.value || !reportName.value.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Please provide a report name',
      color: 'warning',
    })
    return
  }

  isSaving.value = true

  try {
    const body = {
      name: reportName.value.trim(),
      description: reportDescription.value.trim() || undefined,
      dataSource: selectedDataSource.value,
      definition: buildDefinition(),
      isShared: isShared.value,
    }

    if (reportId.value) {
      // Update existing
      await $fetch(`/api/reports/custom/${reportId.value}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Report Updated',
        description: 'Your report has been updated',
        color: 'success',
      })
    } else {
      // Create new
      const result = await $fetch('/api/reports/custom', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Report Saved',
        description: 'Your report has been saved',
        color: 'success',
      })
      // Navigate to the new report
      router.replace(`/reports/custom/builder?id=${result.id}`)
    }
  } catch (error) {
    console.error('Failed to save report:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to save report',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

function exportToCSV() {
  if (!reportResults.value?.data?.length) {
    toast.add({
      title: 'No Data',
      description: 'No data available to export',
      color: 'warning',
    })
    return
  }

  const headers = reportResults.value.columns.map((c) => c.label)
  const rows = reportResults.value.data.map((row) =>
    reportResults.value!.columns.map((c) => {
      const val = row[c.field]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }),
  )

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportName.value || 'report'}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.add({
    title: 'Export Complete',
    description: 'Report has been downloaded',
    color: 'success',
  })
}

function formatCellValue(value: unknown, field: string): string {
  if (value === null || value === undefined) return '-'

  const col = availableColumns.value.find((c) => c.field === field)
  if (col?.type === 'date' && typeof value === 'string') {
    return new Date(value).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (typeof value === 'number') {
    if (field.toLowerCase().includes('cost')) {
      return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return value.toLocaleString('en-AU')
  }

  return String(value)
}

function nextStep() {
  if (currentStep.value < 5) {
    currentStep.value++
    // Auto-run preview when reaching step 5
    if (currentStep.value === 5 && selectedColumnCount.value > 0) {
      runReport()
    }
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const steps = [
  { number: 1, label: 'Data Source', icon: 'i-lucide-database' },
  { number: 2, label: 'Columns', icon: 'i-lucide-columns' },
  { number: 3, label: 'Filters', icon: 'i-lucide-filter' },
  { number: 4, label: 'Grouping', icon: 'i-lucide-layers' },
  { number: 5, label: 'Preview', icon: 'i-lucide-eye' },
]
</script>

<template>
  <UDashboardPanel id="custom-report-builder">
    <template #header>
      <UDashboardNavbar :title="reportId ? 'Edit Custom Report' : 'Create Custom Report'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/reports/custom" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else class="max-w-6xl mx-auto">
        <!-- Step Indicator -->
        <div class="flex items-center justify-center gap-2 mb-8">
          <template v-for="(step, index) in steps" :key="step.number">
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              :class="{
                'bg-primary text-primary-foreground': currentStep === step.number,
                'bg-muted text-muted-foreground hover:bg-muted/80':
                  currentStep !== step.number && step.number <= currentStep,
                'text-muted-foreground': step.number > currentStep,
              }"
              :disabled="step.number > currentStep"
              @click="step.number <= currentStep && (currentStep = step.number)"
            >
              <UIcon :name="step.icon" class="w-4 h-4" />
              <span class="hidden sm:inline text-sm font-medium">{{ step.label }}</span>
            </button>
            <UIcon
              v-if="index < steps.length - 1"
              name="i-lucide-chevron-right"
              class="w-4 h-4 text-muted"
            />
          </template>
        </div>

        <!-- Step 1: Data Source -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold mb-2">Select Data Source</h2>
            <p class="text-muted">Choose what type of data you want to report on</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <UCard
              v-for="source in metadata?.dataSources"
              :key="source.id"
              class="cursor-pointer transition-all"
              :class="{
                'ring-2 ring-primary': selectedDataSource === source.id,
                'hover:shadow-md': selectedDataSource !== source.id,
              }"
              @click="selectDataSource(source.id)"
            >
              <div class="flex items-start gap-4">
                <div
                  class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
                  :class="{
                    'bg-primary text-primary-foreground': selectedDataSource === source.id,
                    'bg-muted': selectedDataSource !== source.id,
                  }"
                >
                  <UIcon :name="source.icon" class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="font-semibold">{{ source.label }}</h3>
                  <p class="text-sm text-muted">{{ source.description }}</p>
                </div>
              </div>
            </UCard>
          </div>

          <div class="flex justify-end">
            <UButton
              label="Next"
              icon="i-lucide-arrow-right"
              trailing
              :disabled="!canProceedStep1"
              @click="nextStep"
            />
          </div>
        </div>

        <!-- Step 2: Columns -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold mb-2">Select Columns</h2>
            <p class="text-muted">Choose which columns to include in your report</p>
          </div>

          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-muted">
              {{ selectedColumnCount }} columns selected
            </span>
            <div class="flex gap-2">
              <UButton label="Select All" size="sm" variant="soft" @click="selectAllColumns" />
              <UButton label="Clear All" size="sm" variant="ghost" @click="clearAllColumns" />
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div
              v-for="col in availableColumns"
              :key="col.field"
              class="flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="{
                'border-primary bg-primary/5': selectedColumns[col.field],
                'border-muted hover:border-primary/50': !selectedColumns[col.field],
              }"
              @click="toggleColumn(col.field)"
            >
              <UCheckbox :model-value="selectedColumns[col.field]" @click.stop />
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate">{{ col.label }}</p>
                <p class="text-xs text-muted capitalize">{{ col.type }}</p>
              </div>
            </div>
          </div>

          <div class="flex justify-between">
            <UButton label="Back" icon="i-lucide-arrow-left" variant="ghost" @click="prevStep" />
            <UButton
              label="Next"
              icon="i-lucide-arrow-right"
              trailing
              :disabled="!canProceedStep2"
              @click="nextStep"
            />
          </div>
        </div>

        <!-- Step 3: Filters -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold mb-2">Apply Filters</h2>
            <p class="text-muted">Narrow down your data with filters (optional)</p>
          </div>

          <!-- Date Range -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">Date Range Filter</h3>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <USelect
                v-model="dateRangeField"
                :items="[{ label: 'None', value: '' }, ...dateColumns.map((c) => ({ label: c.label, value: c.field }))]"
                label="Date Field"
                placeholder="Select date field"
              />
              <UInput v-model="dateRangeStart" type="date" label="Start Date" />
              <UInput v-model="dateRangeEnd" type="date" label="End Date" />
            </div>
          </UCard>

          <!-- Custom Filters -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Custom Filters</h3>
                <UButton label="Add Filter" icon="i-lucide-plus" size="sm" @click="addFilter" />
              </div>
            </template>

            <div v-if="filters.length === 0" class="text-center py-6 text-muted">
              No filters added. Click "Add Filter" to create one.
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(filter, index) in filters"
                :key="index"
                class="flex items-end gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <USelect
                  v-model="filter.field"
                  :items="filterableColumns.map((c) => ({ label: c.label, value: c.field }))"
                  label="Field"
                  class="flex-1"
                />
                <USelect
                  v-model="filter.operator"
                  :items="getFilterOperators(filter.field)"
                  label="Operator"
                  class="flex-1"
                />
                <template v-if="!['isNull', 'isNotNull'].includes(filter.operator)">
                  <USelect
                    v-if="getFilterColumnOptions(filter.field).length > 0"
                    v-model="filter.value as string"
                    :items="getFilterColumnOptions(filter.field).map((o) => ({ label: o, value: o }))"
                    label="Value"
                    class="flex-1"
                  />
                  <UInput v-else v-model="filter.value as string" label="Value" class="flex-1" />
                </template>
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="soft"
                  @click="removeFilter(index)"
                />
              </div>
            </div>
          </UCard>

          <div class="flex justify-between">
            <UButton label="Back" icon="i-lucide-arrow-left" variant="ghost" @click="prevStep" />
            <UButton label="Next" icon="i-lucide-arrow-right" trailing @click="nextStep" />
          </div>
        </div>

        <!-- Step 4: Grouping & Aggregations -->
        <div v-if="currentStep === 4" class="space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold mb-2">Grouping & Aggregations</h2>
            <p class="text-muted">Summarize your data (optional)</p>
          </div>

          <!-- Group By -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">Group By</h3>
            </template>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="col in filterableColumns"
                :key="col.field"
                :color="groupByFields.includes(col.field) ? 'primary' : 'neutral'"
                :variant="groupByFields.includes(col.field) ? 'solid' : 'outline'"
                class="cursor-pointer"
                @click="toggleGroupBy(col.field)"
              >
                {{ col.label }}
              </UBadge>
            </div>
          </UCard>

          <!-- Aggregations -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Aggregations</h3>
                <UButton
                  label="Add Aggregation"
                  icon="i-lucide-plus"
                  size="sm"
                  :disabled="aggregatableColumns.length === 0"
                  @click="addAggregation"
                />
              </div>
            </template>

            <div v-if="aggregatableColumns.length === 0" class="text-center py-6 text-muted">
              No numeric columns available for aggregation
            </div>

            <div v-else-if="aggregations.length === 0" class="text-center py-6 text-muted">
              No aggregations added. Click "Add Aggregation" to create one.
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(agg, index) in aggregations"
                :key="index"
                class="flex items-end gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <USelect
                  v-model="agg.type"
                  :items="metadata?.aggregationTypes || []"
                  label="Function"
                  class="flex-1"
                />
                <USelect
                  v-model="agg.field"
                  :items="aggregatableColumns.map((c) => ({ label: c.label, value: c.field }))"
                  label="Field"
                  class="flex-1"
                />
                <UInput v-model="agg.alias" label="Alias (optional)" placeholder="e.g., total_cost" class="flex-1" />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="soft"
                  @click="removeAggregation(index)"
                />
              </div>
            </div>
          </UCard>

          <!-- Sorting -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">Sort Results</h3>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <USelect
                v-model="orderByField"
                :items="[{ label: 'None', value: '' }, ...sortableColumns.map((c) => ({ label: c.label, value: c.field }))]"
                label="Sort By"
              />
              <USelect
                v-model="orderByDirection"
                :items="[{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]"
                label="Direction"
                :disabled="!orderByField"
              />
            </div>
          </UCard>

          <div class="flex justify-between">
            <UButton label="Back" icon="i-lucide-arrow-left" variant="ghost" @click="prevStep" />
            <UButton label="Preview Report" icon="i-lucide-eye" trailing @click="nextStep" />
          </div>
        </div>

        <!-- Step 5: Preview & Save -->
        <div v-if="currentStep === 5" class="space-y-6">
          <!-- Report Info -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">Report Details</h3>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UInput
                v-model="reportName"
                label="Report Name"
                placeholder="My Custom Report"
                required
              />
              <div class="flex items-end">
                <UCheckbox v-model="isShared" label="Share with organisation" />
              </div>
            </div>
            <UTextarea
              v-model="reportDescription"
              label="Description (optional)"
              placeholder="Describe what this report shows..."
              class="mt-4"
              rows="2"
            />
          </UCard>

          <!-- Actions -->
          <div class="flex items-center justify-between">
            <UButton label="Back" icon="i-lucide-arrow-left" variant="ghost" @click="prevStep" />
            <div class="flex gap-2">
              <UButton
                label="Run Report"
                icon="i-lucide-play"
                color="success"
                :loading="isRunning"
                @click="runReport(1)"
              />
              <UButton
                label="Export CSV"
                icon="i-lucide-download"
                variant="outline"
                :disabled="!reportResults?.data?.length"
                @click="exportToCSV"
              />
              <UButton
                :label="reportId ? 'Update Report' : 'Save Report'"
                icon="i-lucide-save"
                :loading="isSaving"
                :disabled="!reportName.trim()"
                @click="saveReport"
              />
            </div>
          </div>

          <!-- Results -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Preview Results</h3>
                <UBadge v-if="reportResults?.pagination" color="neutral" variant="subtle">
                  {{ reportResults.pagination.total }} records
                </UBadge>
              </div>
            </template>

            <div v-if="isRunning" class="flex justify-center py-12">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
            </div>

            <div v-else-if="!reportResults" class="text-center py-12 text-muted">
              Click "Run Report" to see results
            </div>

            <div v-else-if="!reportResults.data?.length" class="text-center py-12 text-muted">
              No data found for the selected criteria
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-default">
                    <th
                      v-for="col in reportResults.columns"
                      :key="col.field"
                      class="text-left py-3 px-4 font-medium"
                    >
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in reportResults.data"
                    :key="rowIndex"
                    class="border-b border-default hover:bg-elevated/50"
                  >
                    <td
                      v-for="col in reportResults.columns"
                      :key="col.field"
                      class="py-3 px-4"
                    >
                      {{ formatCellValue(row[col.field], col.field) }}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Pagination -->
              <div
                v-if="reportResults.pagination.totalPages > 1"
                class="flex items-center justify-between mt-4 pt-4 border-t border-default"
              >
                <span class="text-sm text-muted">
                  Page {{ reportResults.pagination.page }} of {{ reportResults.pagination.totalPages }}
                </span>
                <div class="flex gap-2">
                  <UButton
                    label="Previous"
                    size="sm"
                    variant="ghost"
                    :disabled="reportResults.pagination.page <= 1"
                    @click="runReport(reportResults.pagination.page - 1)"
                  />
                  <UButton
                    label="Next"
                    size="sm"
                    variant="ghost"
                    :disabled="reportResults.pagination.page >= reportResults.pagination.totalPages"
                    @click="runReport(reportResults.pagination.page + 1)"
                  />
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
