<script setup lang="ts">
/**
 * Maintenance Cost Report Page (US-14.4)
 *
 * Features:
 * - Total cost by asset
 * - Labor vs parts breakdown
 * - Trends over time
 * - Cost per km/hour
 * - Export to CSV
 */

import { sub } from 'date-fns'
import type { ExportColumn } from '~/composables/useReportExport'
import type { Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

// State
const range = shallowRef<Range>({
  start: sub(new Date(), { months: 6 }),
  end: new Date(),
})
const selectedAssetId = ref('')
const selectedCategoryId = ref('')
const sortColumn = ref('totalCost')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Fetch query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (range.value.start) {
    params.startDate = range.value.start.toISOString()
  }
  if (range.value.end) {
    params.endDate = range.value.end.toISOString()
  }
  if (selectedAssetId.value) {
    params.assetId = selectedAssetId.value
  }
  if (selectedCategoryId.value) {
    params.categoryId = selectedCategoryId.value
  }
  return params
})

// Fetch report data
interface AssetCostData {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  categoryId: string | null
  categoryName: string | null
  laborCost: number
  partsCost: number
  totalCost: number
  workOrderCount: number
  hours: number
  mileage: number
  costPerHour: number | null
  costPerKm: number | null
}

interface TrendDataPoint {
  period: string
  laborCost: number
  partsCost: number
  totalCost: number
  workOrderCount: number
}

interface ReportData {
  assetCosts: AssetCostData[]
  totals: {
    totalLabor: number
    totalParts: number
    grandTotal: number
    totalWorkOrders: number
    assetCount: number
    avgCostPerAsset: number
  }
  trendData: TrendDataPoint[]
  laborVsParts: {
    labor: number
    parts: number
    laborPercent: number
    partsPercent: number
  }
  highCostAssets: string[]
}

const { data: reportData, status } = await useFetch<ReportData>('/api/reports/maintenance-costs', {
  lazy: true,
  query: queryParams,
})

// Fetch assets for filter
interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

const { data: assetsData } = await useFetch<{ data: Asset[] }>('/api/assets', { lazy: true })

const assetOptions = computed(() => [
  { label: 'All Assets', value: '' },
  ...(assetsData.value?.data?.map((a: Asset) => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id,
  })) || []),
])

// Fetch categories for filter
interface Category {
  id: string
  name: string
}

const { data: categoriesData } = await useFetch<Category[]>('/api/asset-categories', { lazy: true })

const categoryOptions = computed(() => [
  { label: 'All Categories', value: '' },
  ...(categoriesData.value?.map((c: Category) => ({
    label: c.name,
    value: c.id,
  })) || []),
])

// Sorted asset costs
const sortedAssetCosts = computed(() => {
  if (!reportData.value?.assetCosts) return []

  return [...reportData.value.assetCosts].sort((a, b) => {
    const aVal = a[sortColumn.value as keyof AssetCostData] ?? 0
    const bVal = b[sortColumn.value as keyof AssetCostData] ?? 0

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'desc' ? bVal - aVal : aVal - bVal
    }

    const aStr = String(aVal || '')
    const bStr = String(bVal || '')
    return sortDirection.value === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
  })
})

// Format helpers
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatCostPerUnit(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '-'
  return `$${value.toFixed(4)}/${unit}`
}

// Check if asset is in high-cost list
function isHighCostAsset(assetId: string): boolean {
  return reportData.value?.highCostAssets?.includes(assetId) ?? false
}

// Sort handler
function handleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'desc'
  }
}

// Export columns definition
const exportColumns: ExportColumn[] = [
  { key: 'assetNumber', header: 'Asset Number', width: 15 },
  { key: 'make', header: 'Make', width: 12 },
  { key: 'model', header: 'Model', width: 12 },
  { key: 'categoryName', header: 'Category', width: 15 },
  { key: 'laborCost', header: 'Labor Cost', format: 'currency', width: 15 },
  { key: 'partsCost', header: 'Parts Cost', format: 'currency', width: 15 },
  { key: 'totalCost', header: 'Total Cost', format: 'currency', width: 15 },
  { key: 'workOrderCount', header: 'Work Orders', format: 'number', width: 12 },
  { key: 'hours', header: 'Hours', format: 'number', width: 10 },
  { key: 'mileage', header: 'Mileage (km)', format: 'number', width: 12 },
  { key: 'costPerHour', header: 'Cost/Hour', format: 'currency', width: 12 },
  { key: 'costPerKm', header: 'Cost/km', format: 'currency', width: 12 },
]

// Export summary data
const exportSummary = computed(() => ({
  'Total Labor Cost': formatCurrency(reportData.value?.totals?.totalLabor),
  'Total Parts Cost': formatCurrency(reportData.value?.totals?.totalParts),
  'Grand Total': formatCurrency(reportData.value?.totals?.grandTotal),
  'Average Cost/Asset': formatCurrency(reportData.value?.totals?.avgCostPerAsset),
  'Total Work Orders': reportData.value?.totals?.totalWorkOrders || 0,
  'Total Assets': reportData.value?.totals?.assetCount || 0,
}))

const router = useRouter()
</script>

<template>
  <UDashboardPanel id="maintenance-costs-report">
    <template #header>
      <UDashboardNavbar title="Maintenance Cost Report">
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
            :data="sortedAssetCosts"
            filename="maintenance-costs-report"
            title="Maintenance Cost Report"
            sheet-name="Maintenance Costs"
            :columns="exportColumns"
            :date-range="range"
            :summary="exportSummary"
            :disabled="status === 'pending'"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <MaintenanceCostsDateRangePicker v-model="range" />

        <USelect
          v-model="selectedAssetId"
          :items="assetOptions"
          placeholder="Filter by asset"
          class="min-w-48"
        />

        <USelect
          v-model="selectedCategoryId"
          :items="categoryOptions"
          placeholder="Filter by category"
          class="min-w-40"
        />
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-primary">
              {{ status === 'pending' ? '---' : formatCurrency(reportData?.totals?.totalLabor) }}
            </p>
            <p class="text-sm text-muted">Total Labor Cost</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-info">
              {{ status === 'pending' ? '---' : formatCurrency(reportData?.totals?.totalParts) }}
            </p>
            <p class="text-sm text-muted">Total Parts Cost</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-success">
              {{ status === 'pending' ? '---' : formatCurrency(reportData?.totals?.grandTotal) }}
            </p>
            <p class="text-sm text-muted">Grand Total</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ status === 'pending' ? '---' : formatCurrency(reportData?.totals?.avgCostPerAsset) }}
            </p>
            <p class="text-sm text-muted">Avg Cost/Asset</p>
          </div>
        </UCard>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <MaintenanceCostsPieChart
          :labor-cost="reportData?.laborVsParts?.labor || 0"
          :parts-cost="reportData?.laborVsParts?.parts || 0"
          :loading="status === 'pending'"
        />

        <MaintenanceCostsTrendChart
          :data="reportData?.trendData || []"
          title="Cost Trend"
          :loading="status === 'pending'"
          value-key="totalCost"
        />
      </div>

      <!-- Additional Trend Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <MaintenanceCostsTrendChart
          :data="reportData?.trendData || []"
          title="Labor Cost Trend"
          :loading="status === 'pending'"
          value-key="laborCost"
        />

        <MaintenanceCostsTrendChart
          :data="reportData?.trendData || []"
          title="Parts Cost Trend"
          :loading="status === 'pending'"
          value-key="partsCost"
        />
      </div>

      <!-- Asset Cost Table -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Cost by Asset</h3>
            <UBadge v-if="reportData?.assetCosts?.length" color="neutral" variant="subtle">
              {{ reportData.assetCosts.length }} assets
            </UBadge>
          </div>
        </template>

        <div v-if="status === 'pending'" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>

        <div v-else-if="!reportData?.assetCosts?.length" class="text-center py-12">
          <UIcon name="i-lucide-wrench" class="w-12 h-12 text-muted mx-auto mb-4" />
          <p class="text-lg font-medium">No maintenance cost data</p>
          <p class="text-muted">No completed work orders found for the selected period</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default">
                <th class="text-left py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('assetNumber')"
                  >
                    Asset
                    <UIcon
                      v-if="sortColumn === 'assetNumber'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('laborCost')"
                  >
                    Labor
                    <UIcon
                      v-if="sortColumn === 'laborCost'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('partsCost')"
                  >
                    Parts
                    <UIcon
                      v-if="sortColumn === 'partsCost'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('totalCost')"
                  >
                    Total
                    <UIcon
                      v-if="sortColumn === 'totalCost'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('hours')"
                  >
                    Hours
                    <UIcon
                      v-if="sortColumn === 'hours'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('mileage')"
                  >
                    Mileage
                    <UIcon
                      v-if="sortColumn === 'mileage'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('costPerHour')"
                  >
                    $/Hour
                    <UIcon
                      v-if="sortColumn === 'costPerHour'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
                <th class="text-right py-3 px-4 font-medium">
                  <button
                    type="button"
                    class="flex items-center gap-1 ml-auto hover:text-primary"
                    @click="handleSort('costPerKm')"
                  >
                    $/km
                    <UIcon
                      v-if="sortColumn === 'costPerKm'"
                      :name="sortDirection === 'desc' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                      class="w-4 h-4"
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="asset in sortedAssetCosts"
                :key="asset.assetId"
                class="border-b border-default hover:bg-elevated/50 cursor-pointer"
                :class="{ 'bg-warning/10': isHighCostAsset(asset.assetId) }"
                @click="router.push(`/assets/${asset.assetId}`)"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <div>
                      <p class="font-medium">{{ asset.assetNumber }}</p>
                      <p class="text-xs text-muted">
                        {{ asset.make || '' }} {{ asset.model || '' }}
                      </p>
                    </div>
                    <UBadge
                      v-if="isHighCostAsset(asset.assetId)"
                      color="warning"
                      variant="subtle"
                      size="xs"
                    >
                      High Cost
                    </UBadge>
                  </div>
                </td>
                <td class="py-3 px-4 text-right">{{ formatCurrency(asset.laborCost) }}</td>
                <td class="py-3 px-4 text-right">{{ formatCurrency(asset.partsCost) }}</td>
                <td class="py-3 px-4 text-right font-semibold">{{ formatCurrency(asset.totalCost) }}</td>
                <td class="py-3 px-4 text-right">{{ formatNumber(asset.hours, 1) }}</td>
                <td class="py-3 px-4 text-right">{{ formatNumber(asset.mileage, 0) }} km</td>
                <td class="py-3 px-4 text-right">{{ formatCostPerUnit(asset.costPerHour, 'hr') }}</td>
                <td class="py-3 px-4 text-right">{{ formatCostPerUnit(asset.costPerKm, 'km') }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-elevated font-semibold">
                <td class="py-3 px-4">TOTAL ({{ reportData.totals.assetCount }} assets)</td>
                <td class="py-3 px-4 text-right">{{ formatCurrency(reportData.totals.totalLabor) }}</td>
                <td class="py-3 px-4 text-right">{{ formatCurrency(reportData.totals.totalParts) }}</td>
                <td class="py-3 px-4 text-right">{{ formatCurrency(reportData.totals.grandTotal) }}</td>
                <td class="py-3 px-4 text-right" colspan="4">
                  {{ reportData.totals.totalWorkOrders }} work orders
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
