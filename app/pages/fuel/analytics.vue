<script setup lang="ts">
import { format, sub } from 'date-fns'
import type { Period, Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

// Date range state
const range = shallowRef<Range>({
  start: sub(new Date(), { months: 6 }),
  end: new Date(),
})
const period = ref<Period>('monthly')

// Selected asset filter
const selectedAssetId = ref('')

// Computed query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (range.value.start) {
    params.dateFrom = range.value.start.toISOString()
  }
  if (range.value.end) {
    params.dateTo = range.value.end.toISOString()
  }
  if (selectedAssetId.value) {
    params.assetId = selectedAssetId.value
  }
  return params
})

const trendsQueryParams = computed(() => ({
  ...queryParams.value,
  period: period.value,
}))

// Fetch analytics data
const { data: analyticsData, status: analyticsStatus } = await useFetch('/api/fuel/analytics', {
  lazy: true,
  query: queryParams,
})

const { data: trendsData, status: trendsStatus } = await useFetch('/api/fuel/analytics/trends', {
  lazy: true,
  query: trendsQueryParams,
})

const { data: comparisonData, status: comparisonStatus } = await useFetch(
  '/api/fuel/analytics/comparison',
  {
    lazy: true,
    query: queryParams,
  },
)

const { data: anomaliesData, status: anomaliesStatus } = await useFetch(
  '/api/fuel/analytics/anomalies',
  {
    lazy: true,
    query: queryParams,
  },
)

// Fetch assets for filter
interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

// Per-asset analytics type
interface PerAssetAnalytics {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  totalLitres: number
  totalCost: number
  avgLitersPer100Km: number | null
  transactionCount: number
}

// Comparison item type
interface ComparisonItem {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  efficiencyRank: number
  avgLitersPer100Km: number | null
  avgCostPerKm: number | null
  vsFleetAvgL100Percent: number | null
  efficiencyRating: string
  totalDistanceKm: number
  consumptionDataPoints: number
}

// Anomaly item type
interface AnomalyItem {
  transactionId: string
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  transactionDate: string
  anomalyType: 'high_consumption' | 'low_consumption'
  severity: 'warning' | 'critical'
  litersPerHundredKm: number
  expectedLitersPer100Km: number
  deviationPercent: number
}

const { data: assetsData } = await useFetch<{ data: Asset[] }>('/api/assets', { lazy: true })

const assetOptions = computed(() => [
  { label: 'All Assets', value: '' },
  ...(assetsData.value?.data?.map((a: Asset) => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id,
  })) || []),
])

const periodOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

// Tabs
const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-gauge' },
  { label: 'Trends', value: 'trends', icon: 'i-lucide-trending-up' },
  { label: 'Comparison', value: 'comparison', icon: 'i-lucide-bar-chart-3' },
  { label: 'Anomalies', value: 'anomalies', icon: 'i-lucide-alert-triangle' },
]
const selectedTab = ref('overview')

// Format helpers
function formatNumber(value: number | null | undefined, decimals = 2): string {
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

// Efficiency rating colors
const efficiencyColors: Record<string, string> = {
  excellent: 'success',
  good: 'info',
  average: 'warning',
  poor: 'error',
  unknown: 'neutral',
}

// Trend indicator
function getTrendIcon(trend: string | undefined): string {
  switch (trend) {
    case 'increasing':
      return 'i-lucide-trending-up'
    case 'decreasing':
      return 'i-lucide-trending-down'
    case 'stable':
      return 'i-lucide-minus'
    default:
      return 'i-lucide-help-circle'
  }
}

function getTrendColor(trend: string | undefined, isGoodIfDown = false): string {
  if (isGoodIfDown) {
    switch (trend) {
      case 'increasing':
        return 'text-error'
      case 'decreasing':
        return 'text-success'
      default:
        return 'text-muted'
    }
  }
  switch (trend) {
    case 'increasing':
      return 'text-error'
    case 'decreasing':
      return 'text-success'
    default:
      return 'text-muted'
  }
}

const router = useRouter()
</script>

<template>
  <UDashboardPanel id="fuel-analytics">
    <template #header>
      <UDashboardNavbar title="Fuel Analytics">
        <template #right>
          <UButton
            label="Transactions"
            icon="i-lucide-list"
            color="neutral"
            variant="outline"
            @click="router.push('/fuel')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <FuelAnalyticsDateRangePicker v-model="range" />

        <USelect
          v-model="period"
          :items="periodOptions"
          class="min-w-32"
        />

        <USelect
          v-model="selectedAssetId"
          :items="assetOptions"
          placeholder="Filter by asset"
          class="min-w-48"
        />
      </div>

      <!-- Tab Navigation -->
      <UTabs
        v-model="selectedTab"
        :items="tabs"
        class="mb-6"
      />

      <!-- Overview Tab -->
      <div v-if="selectedTab === 'overview'">
        <!-- Summary Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">
                {{ analyticsData?.overall?.transactionCount || 0 }}
              </p>
              <p class="text-sm text-muted">Transactions</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-info">
                {{ formatNumber(analyticsData?.overall?.totalLitres, 0) }} L
              </p>
              <p class="text-sm text-muted">Total Fuel</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-success">
                {{ formatCurrency(analyticsData?.overall?.totalCost) }}
              </p>
              <p class="text-sm text-muted">Total Cost</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">
                {{ formatNumber(analyticsData?.fleetAverages?.avgLitersPer100Km, 1) }}
              </p>
              <p class="text-sm text-muted">Avg L/100km</p>
            </div>
          </UCard>
        </div>

        <!-- Fleet Averages Card -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UCard>
            <template #header>
              <h3 class="font-semibold">Fleet Consumption Averages</h3>
            </template>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-muted">Average L/100km</span>
                <span class="text-xl font-semibold">
                  {{ formatNumber(analyticsData?.fleetAverages?.avgLitersPer100Km, 2) }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">Average Cost/km</span>
                <span class="text-xl font-semibold">
                  {{ analyticsData?.fleetAverages?.avgCostPerKm ? `$${formatNumber(analyticsData.fleetAverages.avgCostPerKm, 3)}` : '-' }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">Average Fuel Price</span>
                <span class="text-xl font-semibold">
                  {{ analyticsData?.overall?.avgUnitCost ? `$${formatNumber(analyticsData.overall.avgUnitCost, 3)}/L` : '-' }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">Data Points</span>
                <span class="text-sm text-muted">
                  {{ analyticsData?.fleetAverages?.dataPoints || 0 }} consumption records
                </span>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-semibold">Data Quality</h3>
            </template>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-muted">Total Transactions</span>
                <span class="font-semibold">{{ analyticsData?.overall?.transactionCount || 0 }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">With Odometer</span>
                <span class="font-semibold">{{ analyticsData?.overall?.transactionsWithOdometer || 0 }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">Missing Odometer</span>
                <span :class="[anomaliesData?.missingOdometer?.count ? 'text-warning font-semibold' : 'font-semibold']">
                  {{ anomaliesData?.missingOdometer?.count || 0 }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted">Coverage</span>
                <span class="font-semibold">
                  {{ analyticsData?.overall?.transactionCount
                    ? `${Math.round((analyticsData.overall.transactionsWithOdometer / analyticsData.overall.transactionCount) * 100)}%`
                    : '-' }}
                </span>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Top Consumers -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Top Consumers</h3>
          </template>
          <UTable
            :data="analyticsData?.perAsset?.slice(0, 10) || []"
            :columns="[
              { accessorKey: 'assetNumber', header: 'Asset' },
              { accessorKey: 'make', header: 'Make/Model', cell: ({ row }: { row: { original: PerAssetAnalytics } }) => `${row.original.make || ''} ${row.original.model || ''}`.trim() || '-' },
              { accessorKey: 'totalLitres', header: 'Total Litres', cell: ({ row }: { row: { original: PerAssetAnalytics } }) => formatNumber(row.original.totalLitres, 0) },
              { accessorKey: 'totalCost', header: 'Total Cost', cell: ({ row }: { row: { original: PerAssetAnalytics } }) => formatCurrency(row.original.totalCost) },
              { accessorKey: 'avgLitersPer100Km', header: 'L/100km', cell: ({ row }: { row: { original: PerAssetAnalytics } }) => formatNumber(row.original.avgLitersPer100Km, 1) },
              { accessorKey: 'transactionCount', header: 'Transactions' },
            ]"
            :loading="analyticsStatus === 'pending'"
          />
        </UCard>
      </div>

      <!-- Trends Tab -->
      <div v-if="selectedTab === 'trends'">
        <!-- Trend Indicators -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard>
            <div class="text-center">
              <UIcon
                :name="getTrendIcon(trendsData?.trendIndicators?.consumption)"
                :class="['w-8 h-8 mx-auto mb-2', getTrendColor(trendsData?.trendIndicators?.consumption, true)]"
              />
              <p class="text-sm text-muted">Consumption Trend</p>
              <p class="font-semibold capitalize">{{ trendsData?.trendIndicators?.consumption || 'Unknown' }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <UIcon
                :name="getTrendIcon(trendsData?.trendIndicators?.cost)"
                :class="['w-8 h-8 mx-auto mb-2', getTrendColor(trendsData?.trendIndicators?.cost)]"
              />
              <p class="text-sm text-muted">Cost Trend</p>
              <p class="font-semibold capitalize">{{ trendsData?.trendIndicators?.cost || 'Unknown' }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ trendsData?.consumptionTrends?.length || 0 }}</p>
              <p class="text-sm text-muted">Periods Analyzed</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ trendsData?.volumeTrends?.length || 0 }}</p>
              <p class="text-sm text-muted">Data Points</p>
            </div>
          </UCard>
        </div>

        <!-- Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <FuelAnalyticsTrendChart
            :data="trendsData?.consumptionTrends || []"
            title="Consumption Trend (L/100km)"
            :loading="trendsStatus === 'pending'"
            value-key="avgLitersPer100Km"
            :format-value="(v: number) => `${formatNumber(v, 1)} L/100km`"
          />

          <FuelAnalyticsTrendChart
            :data="trendsData?.volumeTrends || []"
            title="Fuel Volume Trend"
            :loading="trendsStatus === 'pending'"
            value-key="totalLitres"
            :format-value="(v: number) => `${formatNumber(v, 0)} L`"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FuelAnalyticsTrendChart
            :data="trendsData?.volumeTrends || []"
            title="Cost Trend"
            :loading="trendsStatus === 'pending'"
            value-key="totalCost"
            :format-value="(v: number) => formatCurrency(v)"
          />

          <FuelAnalyticsTrendChart
            :data="trendsData?.volumeTrends || []"
            title="Unit Price Trend"
            :loading="trendsStatus === 'pending'"
            value-key="avgUnitCost"
            :format-value="(v: number) => `$${formatNumber(v, 3)}/L`"
          />
        </div>
      </div>

      <!-- Comparison Tab -->
      <div v-if="selectedTab === 'comparison'">
        <!-- Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ comparisonData?.summary?.totalVehiclesAnalyzed || 0 }}</p>
              <p class="text-sm text-muted">Vehicles Analyzed</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-success">{{ comparisonData?.summary?.excellentCount || 0 }}</p>
              <p class="text-sm text-muted">Excellent</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-warning">{{ comparisonData?.summary?.averageCount || 0 }}</p>
              <p class="text-sm text-muted">Average</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-error">{{ comparisonData?.summary?.poorCount || 0 }}</p>
              <p class="text-sm text-muted">Poor</p>
            </div>
          </UCard>
        </div>

        <!-- Fleet Average Reference -->
        <UCard class="mb-6">
          <template #header>
            <h3 class="font-semibold">Fleet Average Reference</h3>
          </template>
          <div class="flex flex-wrap gap-8">
            <div>
              <p class="text-sm text-muted">L/100km</p>
              <p class="text-2xl font-bold">{{ formatNumber(comparisonData?.fleetAverages?.avgLitersPer100Km, 2) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Cost/km</p>
              <p class="text-2xl font-bold">{{ comparisonData?.fleetAverages?.avgCostPerKm ? `$${formatNumber(comparisonData.fleetAverages.avgCostPerKm, 3)}` : '-' }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Total Vehicles</p>
              <p class="text-2xl font-bold">{{ comparisonData?.fleetAverages?.totalVehicles || 0 }}</p>
            </div>
          </div>
        </UCard>

        <!-- Comparison Table -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Vehicle Comparison</h3>
          </template>
          <UTable
            :data="comparisonData?.comparison || []"
            :columns="[
              { accessorKey: 'efficiencyRank', header: 'Rank', cell: ({ row }: { row: { original: ComparisonItem } }) => `#${row.original.efficiencyRank}` },
              {
                accessorKey: 'assetNumber',
                header: 'Asset',
                cell: ({ row }: { row: { original: ComparisonItem } }) => h('div', {}, [
                  h('p', { class: 'font-medium' }, row.original.assetNumber),
                  h('p', { class: 'text-sm text-muted' }, `${row.original.make || ''} ${row.original.model || ''}`.trim() || '-'),
                ]),
              },
              { accessorKey: 'avgLitersPer100Km', header: 'L/100km', cell: ({ row }: { row: { original: ComparisonItem } }) => formatNumber(row.original.avgLitersPer100Km, 1) },
              { accessorKey: 'avgCostPerKm', header: 'Cost/km', cell: ({ row }: { row: { original: ComparisonItem } }) => row.original.avgCostPerKm ? `$${formatNumber(row.original.avgCostPerKm, 3)}` : '-' },
              {
                accessorKey: 'vsFleetAvgL100Percent',
                header: 'vs Fleet Avg',
                cell: ({ row }: { row: { original: ComparisonItem } }) => {
                  const val = row.original.vsFleetAvgL100Percent
                  if (val === null) return '-'
                  const color = val < -5 ? 'text-success' : val > 5 ? 'text-error' : 'text-muted'
                  return h('span', { class: color }, `${val > 0 ? '+' : ''}${formatNumber(val, 1)}%`)
                },
              },
              {
                accessorKey: 'efficiencyRating',
                header: 'Rating',
                cell: ({ row }: { row: { original: ComparisonItem } }) => h(resolveComponent('UBadge'), {
                  color: efficiencyColors[row.original.efficiencyRating] || 'neutral',
                  variant: 'subtle',
                }, () => row.original.efficiencyRating),
              },
              { accessorKey: 'totalDistanceKm', header: 'Distance', cell: ({ row }: { row: { original: ComparisonItem } }) => `${formatNumber(row.original.totalDistanceKm, 0)} km` },
              { accessorKey: 'consumptionDataPoints', header: 'Data Points' },
            ]"
            :loading="comparisonStatus === 'pending'"
          />
        </UCard>
      </div>

      <!-- Anomalies Tab -->
      <div v-if="selectedTab === 'anomalies'">
        <!-- Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ anomaliesData?.summary?.totalAnomalies || 0 }}</p>
              <p class="text-sm text-muted">Total Anomalies</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-error">{{ anomaliesData?.summary?.criticalCount || 0 }}</p>
              <p class="text-sm text-muted">Critical</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-warning">{{ anomaliesData?.summary?.warningCount || 0 }}</p>
              <p class="text-sm text-muted">Warnings</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-2xl font-bold text-info">{{ anomaliesData?.summary?.missingOdometerCount || 0 }}</p>
              <p class="text-sm text-muted">Missing Odometer</p>
            </div>
          </UCard>
        </div>

        <!-- Thresholds Info -->
        <UAlert
          v-if="anomaliesData?.thresholds"
          icon="i-lucide-info"
          class="mb-6"
          color="info"
          variant="soft"
          title="Anomaly Detection Thresholds"
          :description="`Warning: >${anomaliesData.thresholds.warningPercent}% deviation from average. Critical: >${anomaliesData.thresholds.criticalPercent}% deviation.`"
        />

        <!-- Assets with Most Anomalies -->
        <UCard v-if="anomaliesData?.assetsWithMostAnomalies?.length" class="mb-6">
          <template #header>
            <h3 class="font-semibold">Assets with Most Anomalies</h3>
          </template>
          <div class="flex flex-wrap gap-4">
            <div
              v-for="asset in anomaliesData.assetsWithMostAnomalies.slice(0, 5)"
              :key="asset.assetId"
              class="flex items-center gap-2 bg-elevated px-3 py-2 rounded-lg"
            >
              <span class="font-medium">{{ asset.assetNumber }}</span>
              <UBadge color="error" variant="subtle">{{ asset.anomalyCount }}</UBadge>
            </div>
          </div>
        </UCard>

        <!-- Anomalies Table -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Detected Anomalies</h3>
          </template>
          <UTable
            :data="anomaliesData?.anomalies || []"
            :columns="[
              {
                accessorKey: 'severity',
                header: 'Severity',
                cell: ({ row }: { row: { original: AnomalyItem } }) => h(resolveComponent('UBadge'), {
                  color: row.original.severity === 'critical' ? 'error' : 'warning',
                  variant: 'subtle',
                }, () => row.original.severity),
              },
              {
                accessorKey: 'assetNumber',
                header: 'Asset',
                cell: ({ row }: { row: { original: AnomalyItem } }) => h('div', {}, [
                  h('p', { class: 'font-medium' }, row.original.assetNumber),
                  h('p', { class: 'text-sm text-muted' }, `${row.original.make || ''} ${row.original.model || ''}`.trim() || '-'),
                ]),
              },
              {
                accessorKey: 'transactionDate',
                header: 'Date',
                cell: ({ row }: { row: { original: AnomalyItem } }) => format(new Date(row.original.transactionDate), 'dd MMM yyyy'),
              },
              {
                accessorKey: 'anomalyType',
                header: 'Type',
                cell: ({ row }: { row: { original: AnomalyItem } }) => row.original.anomalyType === 'high_consumption' ? 'High Consumption' : 'Low Consumption',
              },
              {
                accessorKey: 'litersPerHundredKm',
                header: 'Actual L/100km',
                cell: ({ row }: { row: { original: AnomalyItem } }) => formatNumber(row.original.litersPerHundredKm, 1),
              },
              {
                accessorKey: 'expectedLitersPer100Km',
                header: 'Expected',
                cell: ({ row }: { row: { original: AnomalyItem } }) => formatNumber(row.original.expectedLitersPer100Km, 1),
              },
              {
                accessorKey: 'deviationPercent',
                header: 'Deviation',
                cell: ({ row }: { row: { original: AnomalyItem } }) => {
                  const val = row.original.deviationPercent
                  const color = val > 0 ? 'text-error' : 'text-success'
                  return h('span', { class: color }, `${val > 0 ? '+' : ''}${formatNumber(val, 0)}%`)
                },
              },
            ]"
            :loading="anomaliesStatus === 'pending'"
          />

          <div v-if="!anomaliesData?.anomalies?.length && anomaliesStatus !== 'pending'" class="text-center py-8">
            <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success mx-auto mb-4" />
            <p class="text-lg font-medium">No anomalies detected</p>
            <p class="text-muted">All fuel consumption is within expected ranges</p>
          </div>
        </UCard>

        <!-- Missing Odometer Section -->
        <UCard v-if="anomaliesData?.missingOdometer?.count" class="mt-6">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-alert-circle" class="text-warning" />
              <h3 class="font-semibold">Transactions Missing Odometer</h3>
            </div>
          </template>
          <p class="text-muted mb-4">
            {{ anomaliesData.missingOdometer.count }} transactions are missing odometer readings.
            This limits consumption analysis accuracy.
          </p>
          <UTable
            :data="anomaliesData.missingOdometer.recent"
            :columns="[
              {
                accessorKey: 'assetNumber',
                header: 'Asset',
              },
              {
                accessorKey: 'transactionDate',
                header: 'Date',
                cell: ({ row }) => format(new Date(row.original.transactionDate), 'dd MMM yyyy'),
              },
              {
                accessorKey: 'quantity',
                header: 'Quantity',
                cell: ({ row }) => `${formatNumber(row.original.quantity, 1)} L`,
              },
              {
                accessorKey: 'totalCost',
                header: 'Cost',
                cell: ({ row }) => formatCurrency(row.original.totalCost),
              },
            ]"
          />
        </UCard>
      </div>

      <!-- Loading State -->
      <div v-if="analyticsStatus === 'pending' && selectedTab === 'overview'" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
      </div>
    </template>
  </UDashboardPanel>
</template>
