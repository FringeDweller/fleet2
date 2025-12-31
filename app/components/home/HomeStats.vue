<script setup lang="ts">
import type { Period, Range } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

interface KpiData {
  totalAssets: number
  activeWorkOrders: number
  overdueMaintenanceCount: number
  complianceRate: number
  previousPeriod: {
    totalAssets: number
    activeWorkOrders: number
    overdueMaintenanceCount: number
    complianceRate: number
  }
}

interface KpiStat {
  key: string
  title: string
  icon: string
  value: number | string
  variation: number
  to: string
  formatter?: (value: number) => string
}

// Fetch KPI data from API
const { data: kpiData, refresh } = await useFetch<KpiData>('/api/dashboard/kpis', {
  query: computed(() => ({
    startDate: props.range.start.toISOString(),
    endDate: props.range.end.toISOString(),
  })),
  watch: [() => props.period, () => props.range],
  default: () => ({
    totalAssets: 0,
    activeWorkOrders: 0,
    overdueMaintenanceCount: 0,
    complianceRate: 100,
    previousPeriod: {
      totalAssets: 0,
      activeWorkOrders: 0,
      overdueMaintenanceCount: 0,
      complianceRate: 100,
    },
  }),
})

// Auto-refresh every 60 seconds
const REFRESH_INTERVAL = 60000
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  refreshInterval = setInterval(() => {
    refresh()
  }, REFRESH_INTERVAL)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

/**
 * Calculate percentage variation between current and previous period
 * Positive = increase, Negative = decrease
 */
function calculateVariation(current: number, previous: number): number {
  if (previous === 0) {
    // If previous was 0, and current is positive, show 100% increase
    // If both are 0, show 0% change
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
}

// Compute stats from KPI data
const stats = computed<KpiStat[]>(() => {
  const data = kpiData.value

  return [
    {
      key: 'totalAssets',
      title: 'Total Assets',
      icon: 'i-lucide-truck',
      value: data.totalAssets,
      variation: calculateVariation(data.totalAssets, data.previousPeriod.totalAssets),
      to: '/assets',
    },
    {
      key: 'activeWorkOrders',
      title: 'Active Work Orders',
      icon: 'i-lucide-wrench',
      value: data.activeWorkOrders,
      variation: calculateVariation(data.activeWorkOrders, data.previousPeriod.activeWorkOrders),
      to: '/work-orders?status=open,in_progress',
    },
    {
      key: 'overdueMaintenanceCount',
      title: 'Overdue Maintenance',
      icon: 'i-lucide-alert-triangle',
      value: data.overdueMaintenanceCount,
      variation: calculateVariation(
        data.overdueMaintenanceCount,
        data.previousPeriod.overdueMaintenanceCount,
      ),
      to: '/work-orders?overdue=true',
    },
    {
      key: 'complianceRate',
      title: 'Compliance Rate',
      icon: 'i-lucide-shield-check',
      value: `${data.complianceRate}%`,
      variation: calculateVariation(data.complianceRate, data.previousPeriod.complianceRate),
      to: '/work-orders?status=completed,closed',
    },
  ]
})

/**
 * Determine badge color based on stat type and variation
 * For overdue maintenance, lower is better (so negative variation is success)
 * For compliance rate, higher is better (positive variation is success)
 * For assets and work orders, neutral interpretation
 */
function getBadgeColor(stat: KpiStat): 'success' | 'error' | 'neutral' {
  if (stat.variation === 0) return 'neutral'

  // For overdue maintenance, lower is better
  if (stat.key === 'overdueMaintenanceCount') {
    return stat.variation < 0 ? 'success' : 'error'
  }

  // For compliance rate, higher is better
  if (stat.key === 'complianceRate') {
    return stat.variation > 0 ? 'success' : 'error'
  }

  // For other stats, just show neutral or appropriate color
  return stat.variation > 0 ? 'success' : 'neutral'
}
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="stat in stats"
      :key="stat.key"
      :icon="stat.icon"
      :title="stat.title"
      :to="stat.to"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase',
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>

        <UBadge
          :color="getBadgeColor(stat)"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
