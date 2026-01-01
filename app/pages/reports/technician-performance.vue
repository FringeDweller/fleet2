<script setup lang="ts">
/**
 * Technician Performance Report Page (US-14.5)
 *
 * Features:
 * - WOs completed per technician
 * - Average completion time
 * - First-time fix rate
 * - Rework rate (quality score)
 * - Performance trends over time
 * - Export to CSV
 */

import type { TableColumn } from '@nuxt/ui'
import { sub } from 'date-fns'
import type { ExportColumn } from '~/composables/useReportExport'
import type { Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

// Types
interface TechnicianPerformance {
  technicianId: string
  firstName: string
  lastName: string
  email: string
  fullName: string
  completedCount: number
  avgCompletionHours: number
  avgCustomerRating: number | null
  ratedCount: number
  firstTimeFixCount: number
  reworkCount: number
  firstTimeFixRate: number
  reworkRate: number
  totalLaborCost: number
  totalPartsCost: number
  totalCost: number
}

interface TrendDataPoint {
  period: string
  completedCount: number
  avgCompletionHours: number
}

interface ReportSummary {
  totalTechnicians: number
  totalCompletedWOs: number
  avgCompletedPerTechnician: number
  avgCompletionHours: number
  overallCustomerRating: number | null
  totalRatedWOs: number
  overallFirstTimeFixRate: number
  overallReworkRate: number
  totalCost: number
}

interface ReportResponse {
  technicians: TechnicianPerformance[]
  summary: ReportSummary
  trendData: TrendDataPoint[]
  topPerformers: string[]
  needsAttention: string[]
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UAvatar = resolveComponent('UAvatar')
const UIcon = resolveComponent('UIcon')

// Filter state
const dateRange = ref<Range>({
  start: sub(new Date(), { months: 6 }),
  end: new Date(),
})
const selectedTechnicianId = ref('')
const groupBy = ref('month')

// Sorting state
const sortColumn = ref<string>('completedCount')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Build query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}

  if (dateRange.value.start) {
    params.startDate = dateRange.value.start.toISOString()
  }
  if (dateRange.value.end) {
    params.endDate = dateRange.value.end.toISOString()
  }
  if (selectedTechnicianId.value) {
    params.technicianId = selectedTechnicianId.value
  }
  params.groupBy = groupBy.value

  return params
})

// Fetch report data
const {
  data: reportData,
  status: fetchStatus,
  refresh,
} = await useFetch<ReportResponse>('/api/reports/technician-performance', {
  query: queryParams,
  lazy: true,
  watch: [queryParams],
})

const summary = computed(
  () =>
    reportData.value?.summary || {
      totalTechnicians: 0,
      totalCompletedWOs: 0,
      avgCompletedPerTechnician: 0,
      avgCompletionHours: 0,
      overallCustomerRating: null,
      totalRatedWOs: 0,
      overallFirstTimeFixRate: 0,
      overallReworkRate: 0,
      totalCost: 0,
    },
)

// Technician options for filter
const technicianOptions = computed(() => [
  { label: 'All Technicians', value: '' },
  ...(reportData.value?.technicians.map((t: TechnicianPerformance) => ({
    label: t.fullName,
    value: t.technicianId,
  })) || []),
])

// Group by options
const groupByOptions = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
]

// Filter and sort technicians
const filteredTechnicians = computed(() => {
  const technicians = reportData.value?.technicians || []

  return [...technicians].sort((a, b) => {
    const aVal = a[sortColumn.value as keyof TechnicianPerformance]
    const bVal = b[sortColumn.value as keyof TechnicianPerformance]

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
    sortDirection.value = 'desc'
  }
}

function getSortIcon(column: string) {
  if (sortColumn.value !== column) return 'i-lucide-arrow-up-down'
  return sortDirection.value === 'asc'
    ? 'i-lucide-arrow-up-narrow-wide'
    : 'i-lucide-arrow-down-wide-narrow'
}

// Check if technician is top performer
function isTopPerformer(technicianId: string): boolean {
  return reportData.value?.topPerformers?.includes(technicianId) ?? false
}

// Check if technician needs attention
function needsAttention(technicianId: string): boolean {
  return reportData.value?.needsAttention?.includes(technicianId) ?? false
}

// Format helpers
function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)} hrs`
}

function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toFixed(1)
}

function getRatingColor(rating: number | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (rating === null) return 'neutral'
  if (rating >= 4.5) return 'success'
  if (rating >= 3.5) return 'warning'
  return 'error'
}

function getPerformanceColor(rate: number): 'success' | 'warning' | 'error' {
  if (rate >= 90) return 'success'
  if (rate >= 70) return 'warning'
  return 'error'
}

function getReworkColor(rate: number): 'success' | 'warning' | 'error' {
  if (rate <= 10) return 'success'
  if (rate <= 25) return 'warning'
  return 'error'
}

// Export columns definition
const exportColumns: ExportColumn[] = [
  { key: 'fullName', header: 'Technician', width: 20 },
  { key: 'email', header: 'Email', width: 25 },
  { key: 'completedCount', header: 'WOs Completed', format: 'number', width: 15 },
  { key: 'avgCompletionHours', header: 'Avg Completion (hrs)', format: 'number', width: 18 },
  { key: 'avgCustomerRating', header: 'Avg Customer Rating', format: 'number', width: 18 },
  { key: 'ratedCount', header: 'Rated WOs', format: 'number', width: 12 },
  { key: 'firstTimeFixRate', header: 'First-Time Fix Rate', format: 'percent', width: 18 },
  { key: 'reworkRate', header: 'Rework Rate', format: 'percent', width: 15 },
  { key: 'firstTimeFixCount', header: 'First-Time Fix Count', format: 'number', width: 18 },
  { key: 'reworkCount', header: 'Rework Count', format: 'number', width: 15 },
  { key: 'totalLaborCost', header: 'Labor Cost', format: 'currency', width: 15 },
  { key: 'totalPartsCost', header: 'Parts Cost', format: 'currency', width: 15 },
  { key: 'totalCost', header: 'Total Cost', format: 'currency', width: 15 },
]

// Export summary data
const exportSummary = computed(() => ({
  'Total Technicians': summary.value.totalTechnicians,
  'WOs Completed': summary.value.totalCompletedWOs,
  'Avg Customer Rating':
    summary.value.overallCustomerRating !== null
      ? formatRating(summary.value.overallCustomerRating)
      : '-',
  'Total Rated WOs': summary.value.totalRatedWOs,
  'First-Time Fix Rate': formatPercent(summary.value.overallFirstTimeFixRate),
  'Rework Rate': formatPercent(summary.value.overallReworkRate),
  'Avg Completion Time': formatHours(summary.value.avgCompletionHours),
  'Total Cost': formatCurrency(summary.value.totalCost),
}))

// Clear filters
function clearFilters() {
  selectedTechnicianId.value = ''
  groupBy.value = 'month'
  dateRange.value = {
    start: sub(new Date(), { months: 6 }),
    end: new Date(),
  }
}

// Table columns
const columns: TableColumn<TechnicianPerformance>[] = [
  {
    accessorKey: 'fullName',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Technician',
        icon: getSortIcon('fullName'),
        class: '-mx-2.5',
        onClick: () => toggleSort('fullName'),
      })
    },
    cell: ({ row }) => {
      const tech = row.original
      const badges: ReturnType<typeof h>[] = []

      if (isTopPerformer(tech.technicianId)) {
        badges.push(
          h(
            UBadge,
            { color: 'success', variant: 'subtle', size: 'xs', class: 'ml-2' },
            () => 'Top',
          ),
        )
      }
      if (needsAttention(tech.technicianId)) {
        badges.push(
          h(
            UBadge,
            { color: 'warning', variant: 'subtle', size: 'xs', class: 'ml-2' },
            () => 'Review',
          ),
        )
      }

      return h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, {
          size: 'sm',
          text: tech.fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase(),
        }),
        h('div', {}, [
          h('div', { class: 'flex items-center' }, [
            h('span', { class: 'font-medium text-highlighted' }, tech.fullName),
            ...badges,
          ]),
          h('span', { class: 'text-xs text-muted' }, tech.email),
        ]),
      ])
    },
  },
  {
    accessorKey: 'completedCount',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'WOs Completed',
        icon: getSortIcon('completedCount'),
        class: '-mx-2.5',
        onClick: () => toggleSort('completedCount'),
      })
    },
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums font-medium' }, row.original.completedCount),
  },
  {
    accessorKey: 'avgCompletionHours',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Avg Time',
        icon: getSortIcon('avgCompletionHours'),
        class: '-mx-2.5',
        onClick: () => toggleSort('avgCompletionHours'),
      })
    },
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums' }, formatHours(row.original.avgCompletionHours)),
  },
  {
    accessorKey: 'firstTimeFixRate',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'First-Time Fix',
        icon: getSortIcon('firstTimeFixRate'),
        class: '-mx-2.5',
        onClick: () => toggleSort('firstTimeFixRate'),
      })
    },
    cell: ({ row }) => {
      const rate = row.original.firstTimeFixRate
      return h(
        UBadge,
        { variant: 'subtle', color: getPerformanceColor(rate), class: 'tabular-nums' },
        () => formatPercent(rate),
      )
    },
  },
  {
    accessorKey: 'avgCustomerRating',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Avg Rating',
        icon: getSortIcon('avgCustomerRating'),
        class: '-mx-2.5',
        onClick: () => toggleSort('avgCustomerRating'),
      })
    },
    cell: ({ row }) => {
      const rating = row.original.avgCustomerRating
      const ratedCount = row.original.ratedCount
      if (rating === null || ratedCount === 0) {
        return h('span', { class: 'text-muted' }, '-')
      }
      return h('div', { class: 'flex items-center gap-1' }, [
        h(UIcon, { name: 'i-lucide-star', class: `w-4 h-4 text-${getRatingColor(rating)}-500` }),
        h(UBadge, { variant: 'subtle', color: getRatingColor(rating), class: 'tabular-nums' }, () =>
          formatRating(rating),
        ),
      ])
    },
  },
  {
    accessorKey: 'reworkRate',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Rework Rate',
        icon: getSortIcon('reworkRate'),
        class: '-mx-2.5',
        onClick: () => toggleSort('reworkRate'),
      })
    },
    cell: ({ row }) => {
      const rate = row.original.reworkRate
      return h(
        UBadge,
        { variant: 'subtle', color: getReworkColor(rate), class: 'tabular-nums' },
        () => formatPercent(rate),
      )
    },
  },
  {
    accessorKey: 'totalCost',
    header: () => {
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Total Cost',
        icon: getSortIcon('totalCost'),
        class: '-mx-2.5',
        onClick: () => toggleSort('totalCost'),
      })
    },
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, formatCurrency(row.original.totalCost)),
  },
]
</script>

<template>
  <UDashboardPanel id="technician-performance-report">
    <template #header>
      <UDashboardNavbar title="Technician Performance Report">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/reports"
          />
        </template>

        <template #right>
          <ReportsReportExportButton
            :data="filteredTechnicians"
            filename="technician-performance-report"
            title="Technician Performance Report"
            sheet-name="Technician Performance"
            :columns="exportColumns"
            :date-range="dateRange"
            :summary="exportSummary"
            :disabled="fetchStatus === 'pending'"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <HomeDateRangePicker v-model="dateRange" class="-ms-1" />

          <USelect
            v-model="selectedTechnicianId"
            :items="technicianOptions"
            placeholder="Filter by technician"
            class="min-w-48"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
            }"
          />

          <USelect
            v-model="groupBy"
            :items="groupByOptions"
            placeholder="Group by"
            class="min-w-32"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
            }"
          />

          <UButton
            v-if="selectedTechnicianId"
            label="Clear"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearFilters"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <UIcon name="i-lucide-users" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Technicians
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.totalTechnicians }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-info-100 dark:bg-info-900/30">
              <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-info-600 dark:text-info-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                WOs Completed
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ formatNumber(summary.totalCompletedWOs) }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30">
              <UIcon name="i-lucide-clock" class="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Avg Completion Time
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ formatHours(summary.avgCompletionHours) }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <UIcon name="i-lucide-star" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                Avg Customer Rating
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ summary.overallCustomerRating !== null ? formatRating(summary.overallCustomerRating) : '-' }}
                <span v-if="summary.overallCustomerRating !== null" class="text-sm text-muted font-normal">/ 5</span>
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30">
              <UIcon name="i-lucide-target" class="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p class="text-sm text-muted">
                First-Time Fix Rate
              </p>
              <p class="text-2xl font-semibold text-highlighted tabular-nums">
                {{ formatPercent(summary.overallFirstTimeFixRate) }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Bar Chart - WOs per Technician -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Work Orders by Technician</h3>
          </template>
          <div v-if="fetchStatus === 'pending'" class="flex justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
          </div>
          <div v-else-if="!filteredTechnicians.length" class="text-center py-12 text-muted">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="tech in filteredTechnicians.slice(0, 10)"
              :key="tech.technicianId"
              class="flex items-center gap-3"
            >
              <span class="text-sm w-32 truncate" :title="tech.fullName">
                {{ tech.fullName }}
              </span>
              <div class="flex-1 bg-default rounded-full h-4 overflow-hidden">
                <div
                  class="bg-primary h-full rounded-full transition-all duration-500"
                  :style="{
                    width: `${filteredTechnicians.length > 0
                      ? (tech.completedCount / Math.max(...filteredTechnicians.map(t => t.completedCount))) * 100
                      : 0}%`
                  }"
                />
              </div>
              <span class="text-sm tabular-nums w-10 text-right">{{ tech.completedCount }}</span>
            </div>
          </div>
        </UCard>

        <!-- Bar Chart - First-Time Fix Rate -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">First-Time Fix Rate by Technician</h3>
          </template>
          <div v-if="fetchStatus === 'pending'" class="flex justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
          </div>
          <div v-else-if="!filteredTechnicians.length" class="text-center py-12 text-muted">
            No data available
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="tech in [...filteredTechnicians]
                .filter(t => t.completedCount >= 1)
                .sort((a, b) => b.firstTimeFixRate - a.firstTimeFixRate)
                .slice(0, 10)"
              :key="tech.technicianId"
              class="flex items-center gap-3"
            >
              <span class="text-sm w-32 truncate" :title="tech.fullName">
                {{ tech.fullName }}
              </span>
              <div class="flex-1 bg-default rounded-full h-4 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="{
                    'bg-success': tech.firstTimeFixRate >= 90,
                    'bg-warning': tech.firstTimeFixRate >= 70 && tech.firstTimeFixRate < 90,
                    'bg-error': tech.firstTimeFixRate < 70,
                  }"
                  :style="{ width: `${tech.firstTimeFixRate}%` }"
                />
              </div>
              <span class="text-sm tabular-nums w-14 text-right">{{ formatPercent(tech.firstTimeFixRate) }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Trend Chart -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Performance Trend</h3>
            <UBadge v-if="reportData?.trendData?.length" color="neutral" variant="subtle">
              {{ reportData.trendData.length }} periods
            </UBadge>
          </div>
        </template>
        <div v-if="fetchStatus === 'pending'" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>
        <div v-else-if="!reportData?.trendData?.length" class="text-center py-12 text-muted">
          No trend data available
        </div>
        <div v-else class="overflow-x-auto">
          <div class="flex items-end gap-2 h-48 min-w-max px-2">
            <div
              v-for="point in reportData.trendData"
              :key="point.period"
              class="flex flex-col items-center gap-1 flex-1 min-w-12"
            >
              <span class="text-xs tabular-nums text-muted">{{ point.completedCount }}</span>
              <div
                class="w-full bg-primary rounded-t transition-all duration-500"
                :style="{
                  height: `${reportData.trendData.length > 0
                    ? (point.completedCount / Math.max(...reportData.trendData.map((t: TrendDataPoint) => t.completedCount))) * 150
                    : 0}px`
                }"
              />
              <span class="text-xs text-muted truncate max-w-full" :title="point.period">
                {{ point.period.slice(-5) }}
              </span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Results Summary -->
      <div class="flex items-center justify-between mb-2 text-sm text-muted">
        <span>{{ filteredTechnicians.length }} technician{{ filteredTechnicians.length === 1 ? '' : 's' }} shown</span>
      </div>

      <!-- Data Table -->
      <UTable
        class="shrink-0"
        :data="filteredTechnicians"
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
        v-if="filteredTechnicians.length === 0 && fetchStatus !== 'pending'"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon name="i-lucide-users" class="w-12 h-12 text-muted mb-4" />
        <h3 class="text-lg font-medium text-highlighted mb-2">
          No technician data found
        </h3>
        <p class="text-sm text-muted max-w-md">
          No completed work orders found for technicians in the selected date range.
          Try adjusting the date range filter.
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
