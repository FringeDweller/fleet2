<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { sub } from 'date-fns'
import type { Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

interface AssetUtilisation {
  id: string
  assetNumber: string
  categoryId: string | null
  categoryName: string | null
  operationalHours: number
  mileage: number
  hoursVsAvgPct: number
  mileageVsAvgPct: number
  status: string
  make: string | null
  model: string | null
  year: number | null
  isUnderutilised: boolean
}

interface ReportSummary {
  totalAssets: number
  totalHours: number
  totalMileage: number
  avgHoursPerAsset: number
  avgMileagePerAsset: number
  underutilisedCount: number
  underutilisedPct: number
}

interface ReportResponse {
  summary: ReportSummary
  assets: AssetUtilisation[]
  threshold: number
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()
const router = useRouter()

// Filter state
const selectedCategoryId = ref('')
const dateRange = ref<Range>({
  start: sub(new Date(), { months: 12 }),
  end: new Date(),
})
const underutilisationThreshold = ref(50)
const showOnlyUnderutilised = ref(false)

// Sorting state
const sortColumn = ref<string>('assetNumber')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Fetch categories for filter dropdown
const { data: categories } = await useFetch<{ id: string; name: string }[]>(
  '/api/asset-categories',
  { lazy: true },
)

// Build query params for API
const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    threshold: underutilisationThreshold.value,
  }

  if (selectedCategoryId.value) {
    params.categoryId = selectedCategoryId.value
  }

  if (dateRange.value.start) {
    params.startDate = dateRange.value.start.toISOString()
  }

  if (dateRange.value.end) {
    params.endDate = dateRange.value.end.toISOString()
  }

  return params
})

// Fetch report data
const {
  data: reportData,
  status: fetchStatus,
  refresh,
} = await useFetch<ReportResponse>('/api/reports/asset-utilisation', {
  query: queryParams,
  lazy: true,
  watch: [queryParams],
})

const summary = computed(
  () =>
    reportData.value?.summary || {
      totalAssets: 0,
      totalHours: 0,
      totalMileage: 0,
      avgHoursPerAsset: 0,
      avgMileagePerAsset: 0,
      underutilisedCount: 0,
      underutilisedPct: 0,
    },
)

// Filter and sort assets
const filteredAssets = computed(() => {
  let assets = reportData.value?.assets || []

  // Filter to underutilised only if toggle is on
  if (showOnlyUnderutilised.value) {
    assets = assets.filter((a: AssetUtilisation) => a.isUnderutilised)
  }

  // Sort
  return [...assets].sort((a, b) => {
    const aVal = a[sortColumn.value as keyof AssetUtilisation]
    const bVal = b[sortColumn.value as keyof AssetUtilisation]

    if (aVal === null || aVal === undefined) return sortDirection.value === 'asc' ? 1 : -1
    if (bVal === null || bVal === undefined) return sortDirection.value === 'asc' ? -1 : 1

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal
    }

    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    return sortDirection.value === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })
})

function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

function getSortIcon(column: string) {
  if (sortColumn.value !== column) return 'i-lucide-arrow-up-down'
  return sortDirection.value === 'asc'
    ? 'i-lucide-arrow-up-narrow-wide'
    : 'i-lucide-arrow-down-wide-narrow'
}

// Export to CSV
async function exportToCSV() {
  try {
    const params = new URLSearchParams()
    params.set('threshold', underutilisationThreshold.value.toString())

    if (selectedCategoryId.value) {
      params.set('categoryId', selectedCategoryId.value)
    }

    if (dateRange.value.start) {
      params.set('startDate', dateRange.value.start.toISOString())
    }

    if (dateRange.value.end) {
      params.set('endDate', dateRange.value.end.toISOString())
    }

    window.location.href = `/api/reports/asset-utilisation/export?${params.toString()}`
    toast.add({ title: 'Export started', description: 'Your CSV download will begin shortly' })
  } catch {
    toast.add({ title: 'Error', description: 'Failed to export report', color: 'error' })
  }
}

// Clear filters
function clearFilters() {
  selectedCategoryId.value = ''
  dateRange.value = {
    start: sub(new Date(), { months: 12 }),
    end: new Date(),
  }
  underutilisationThreshold.value = 50
  showOnlyUnderutilised.value = false
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error',
} as const

// Table columns
const columns: TableColumn<AssetUtilisation>[] = [
  {
    accessorKey: 'assetNumber',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Asset #',
        icon: getSortIcon('assetNumber'),
        class: '-mx-2.5',
        onClick: () => toggleSort('assetNumber'),
      })
    },
    cell: ({ row }) =>
      h('div', { class: 'font-medium text-highlighted' }, row.original.assetNumber),
  },
  {
    accessorKey: 'categoryName',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Category',
        icon: getSortIcon('categoryName'),
        class: '-mx-2.5',
        onClick: () => toggleSort('categoryName'),
      })
    },
    cell: ({ row }) => row.original.categoryName || '-',
  },
  {
    accessorKey: 'operationalHours',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Hours',
        icon: getSortIcon('operationalHours'),
        class: '-mx-2.5',
        onClick: () => toggleSort('operationalHours'),
      })
    },
    cell: ({ row }) => {
      const hours = row.original.operationalHours
      return h('span', undefined, hours > 0 ? `${hours.toLocaleString()} hrs` : '-')
    },
  },
  {
    accessorKey: 'mileage',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Mileage',
        icon: getSortIcon('mileage'),
        class: '-mx-2.5',
        onClick: () => toggleSort('mileage'),
      })
    },
    cell: ({ row }) => {
      const mileage = row.original.mileage
      return h('span', undefined, mileage > 0 ? `${mileage.toLocaleString()} km` : '-')
    },
  },
  {
    id: 'hoursVsAvg',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Hours vs Avg',
        icon: getSortIcon('hoursVsAvgPct'),
        class: '-mx-2.5',
        onClick: () => toggleSort('hoursVsAvgPct'),
      })
    },
    cell: ({ row }) => {
      const pct = row.original.hoursVsAvgPct
      const threshold = reportData.value?.threshold || 50
      const color = pct < threshold ? 'error' : pct >= 100 ? 'success' : 'warning'
      return h(
        UBadge,
        { variant: 'subtle', color, class: 'tabular-nums' },
        () => `${pct.toFixed(1)}%`,
      )
    },
  },
  {
    id: 'mileageVsAvg',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Mileage vs Avg',
        icon: getSortIcon('mileageVsAvgPct'),
        class: '-mx-2.5',
        onClick: () => toggleSort('mileageVsAvgPct'),
      })
    },
    cell: ({ row }) => {
      const pct = row.original.mileageVsAvgPct
      const threshold = reportData.value?.threshold || 50
      const color = pct < threshold ? 'error' : pct >= 100 ? 'success' : 'warning'
      return h(
        UBadge,
        { variant: 'subtle', color, class: 'tabular-nums' },
        () => `${pct.toFixed(1)}%`,
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status as keyof typeof statusColors
      const color = statusColors[status] || 'neutral'
      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () => status)
    },
  },
  {
    id: 'utilisation',
    header: 'Utilisation',
    cell: ({ row }) => {
      if (row.original.isUnderutilised) {
        return h(UBadge, { color: 'error', variant: 'solid', size: 'xs' }, () => 'Underutilised')
      }
      return h(UBadge, { color: 'success', variant: 'subtle', size: 'xs' }, () => 'Normal')
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(UButton, {
        icon: 'i-lucide-eye',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        onClick: () => router.push(`/assets/${row.original.id}`),
      })
    },
  },
]
</script>

<template>
  <UDashboardPanel id="asset-utilisation-report">
    <template #header>
      <UDashboardNavbar title="Asset Utilisation Report">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Export CSV"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            @click="exportToCSV"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <HomeDateRangePicker v-model="dateRange" class="-ms-1" />

          <USelect
            v-model="selectedCategoryId"
            :items="[
              { label: 'All Categories', value: '' },
              ...(categories || []).map(c => ({ label: c.name, value: c.id }))
            ]"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
            }"
            class="min-w-36"
          />

          <div class="flex items-center gap-2">
            <span class="text-sm text-muted whitespace-nowrap">Threshold:</span>
            <UInput
              v-model.number="underutilisationThreshold"
              type="number"
              min="0"
              max="100"
              class="w-20"
              :ui="{ base: 'text-center' }"
            />
            <span class="text-sm text-muted">%</span>
          </div>

          <UButton
            v-if="selectedCategoryId || underutilisationThreshold !== 50"
            label="Clear"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearFilters"
          />
        </template>

        <template #right>
          <UCheckbox
            v-model="showOnlyUnderutilised"
            label="Show underutilised only"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <UIcon name="i-lucide-truck" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Total Assets
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.totalAssets }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-info-100 dark:bg-info-900/30">
              <UIcon name="i-lucide-clock" class="w-5 h-5 text-info-600 dark:text-info-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Avg Hours/Asset
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.avgHoursPerAsset.toLocaleString() }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30">
              <UIcon name="i-lucide-gauge" class="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Avg Mileage/Asset
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.avgMileagePerAsset.toLocaleString() }} km
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-error-100 dark:bg-error-900/30">
              <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-error-600 dark:text-error-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Underutilised
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.underutilisedCount }}
                <span class="text-sm font-normal text-muted">({{ summary.underutilisedPct }}%)</span>
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Results Summary -->
      <div class="flex items-center justify-between mb-2 text-sm text-muted">
        <span>{{ filteredAssets.length }} asset{{ filteredAssets.length === 1 ? '' : 's' }} shown</span>
        <span v-if="showOnlyUnderutilised" class="text-error-600 dark:text-error-400">
          Showing underutilised assets only (below {{ underutilisationThreshold }}% of fleet average)
        </span>
      </div>

      <!-- Data Table -->
      <UTable
        class="shrink-0"
        :data="filteredAssets"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />

      <!-- Empty State -->
      <div
        v-if="filteredAssets.length === 0 && fetchStatus !== 'pending'"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon name="i-lucide-search-x" class="w-12 h-12 text-muted mb-4" />
        <h3 class="text-lg font-medium text-highlighted mb-2">
          No assets found
        </h3>
        <p class="text-sm text-muted max-w-md">
          <template v-if="showOnlyUnderutilised">
            No underutilised assets found with the current filters. Try adjusting the threshold or category filter.
          </template>
          <template v-else>
            No assets match the current filter criteria. Try adjusting the date range or category filter.
          </template>
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
