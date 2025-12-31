<script setup lang="ts">
/**
 * Fuel Anomalies Dashboard Widget (US-11.5)
 *
 * Shows recent fuel consumption anomalies on the dashboard.
 */

interface AnomalySummary {
  totalAnomalies: number
  highConsumptionCount: number
  lowConsumptionCount: number
  criticalCount: number
  warningCount: number
  missingOdometerCount: number
}

interface Anomaly {
  transactionId: string
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  transactionDate: string
  quantity: number
  totalCost: number | null
  litersPerHundredKm: number
  expectedLitersPer100Km: number
  deviationPercent: number
  anomalyType: 'high_consumption' | 'low_consumption' | 'no_odometer'
  severity: 'warning' | 'critical'
}

interface MissingOdometer {
  transactionId: string
  assetId: string
  assetNumber: string | null
  transactionDate: string
  quantity: number
}

interface AnomaliesResponse {
  anomalies: Anomaly[]
  missingOdometer: {
    count: number
    recent: MissingOdometer[]
  }
  summary: AnomalySummary
  thresholds: {
    warningPercent: number
    criticalPercent: number
  }
}

const { data, status, refresh } = await useFetch<AnomaliesResponse>(
  '/api/fuel/analytics/anomalies',
  {
    query: {
      // Last 30 days
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  },
)

const anomalies = computed(() => data.value?.anomalies ?? [])
const summary = computed(() => data.value?.summary)
const missingOdometer = computed(() => data.value?.missingOdometer)

// Total issues count
const totalIssues = computed(() => {
  if (!summary.value) return 0
  return summary.value.totalAnomalies + (summary.value.missingOdometerCount ?? 0)
})

// Auto refresh every 5 minutes
onMounted(() => {
  const interval = setInterval(refresh, 5 * 60 * 1000)
  onUnmounted(() => clearInterval(interval))
})

// Format date for display
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

// Get severity color
function getSeverityColor(severity: 'warning' | 'critical') {
  return severity === 'critical' ? 'error' : 'warning'
}

// Get anomaly type label
function getAnomalyTypeLabel(type: string) {
  switch (type) {
    case 'high_consumption':
      return 'High'
    case 'low_consumption':
      return 'Low'
    case 'no_odometer':
      return 'No ODO'
    default:
      return type
  }
}
</script>

<template>
  <UPageCard
    title="Fuel Anomalies"
    variant="subtle"
    :ui="{
      header: 'border-b border-default-200 pb-3',
      body: 'p-0',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-fuel" class="size-5 text-primary" />
          <span class="font-semibold">Fuel Anomalies</span>
          <UBadge
            v-if="totalIssues > 0"
            :color="summary?.criticalCount ? 'error' : 'warning'"
            variant="subtle"
          >
            {{ totalIssues }}
          </UBadge>
        </div>
        <NuxtLink to="/fuel/analytics" class="text-sm text-primary hover:underline">
          View all
        </NuxtLink>
      </div>
    </template>

    <div v-if="status === 'pending'" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
    </div>

    <div v-else-if="totalIssues === 0" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-check-circle" class="size-8 text-success mb-2" />
      <p>No fuel anomalies detected</p>
    </div>

    <div v-else>
      <!-- Summary stats -->
      <div class="grid grid-cols-3 gap-4 p-4 border-b border-default-200">
        <div class="text-center">
          <div class="text-2xl font-bold text-error">{{ summary?.criticalCount ?? 0 }}</div>
          <div class="text-xs text-muted">Critical</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-warning">{{ summary?.warningCount ?? 0 }}</div>
          <div class="text-xs text-muted">Warning</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-info">{{ missingOdometer?.count ?? 0 }}</div>
          <div class="text-xs text-muted">No Odometer</div>
        </div>
      </div>

      <!-- Anomalies list (show first 5) -->
      <div class="divide-y divide-default-200">
        <div
          v-for="anomaly in anomalies.slice(0, 5)"
          :key="anomaly.transactionId"
          class="flex items-center justify-between p-3 hover:bg-default-50"
        >
          <div class="flex-1 min-w-0">
            <NuxtLink
              :to="`/fuel/analytics?assetId=${anomaly.assetId}`"
              class="font-medium hover:text-primary"
            >
              {{ anomaly.assetNumber }}
            </NuxtLink>
            <div class="text-xs text-muted">
              {{ formatDate(anomaly.transactionDate) }} - {{ anomaly.litersPerHundredKm.toFixed(1) }} L/100km
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-right">
              <div
                :class="[
                  'font-semibold text-sm',
                  anomaly.deviationPercent > 0 ? 'text-error' : 'text-info',
                ]"
              >
                {{ anomaly.deviationPercent > 0 ? '+' : '' }}{{ anomaly.deviationPercent.toFixed(0) }}%
              </div>
            </div>
            <UBadge
              :color="getSeverityColor(anomaly.severity)"
              variant="subtle"
              size="xs"
            >
              {{ getAnomalyTypeLabel(anomaly.anomalyType) }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Footer link -->
      <div
        v-if="anomalies.length > 5 || (missingOdometer?.count ?? 0) > 0"
        class="p-3 text-center border-t border-default-200"
      >
        <NuxtLink
          to="/fuel/analytics"
          class="text-sm text-primary hover:underline flex items-center justify-center gap-1"
        >
          <template v-if="anomalies.length > 5">
            View {{ anomalies.length - 5 }} more anomalies
          </template>
          <template v-else>
            View full analysis
          </template>
          <UIcon name="i-lucide-arrow-right" class="size-4" />
        </NuxtLink>
      </div>
    </div>
  </UPageCard>
</template>
