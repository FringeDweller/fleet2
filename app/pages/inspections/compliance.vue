<script setup lang="ts">
import { format, sub } from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()

// Date range state
const endDate = ref(new Date())
const startDate = ref(sub(new Date(), { days: 30 }))

const dateParams = computed(() => ({
  startDate: format(startDate.value, 'yyyy-MM-dd'),
  endDate: format(endDate.value, 'yyyy-MM-dd'),
}))

// Fetch compliance stats
const { data: stats, status: statsStatus } = await useFetch('/api/inspections/compliance/stats', {
  lazy: true,
  query: dateParams,
})

// Fetch trends data
const { data: trends, status: trendsStatus } = await useFetch('/api/inspections/trends', {
  lazy: true,
  query: computed(() => ({
    ...dateParams.value,
    granularity: 'daily',
  })),
})

// Format numbers
function formatPercent(value: number | undefined): string {
  if (value === undefined) return '0%'
  return `${value.toFixed(1)}%`
}

// Stat card helper
interface StatCard {
  title: string
  value: string | number
  icon: string
  color: string
  description?: string
}

const summaryCards = computed<StatCard[]>(() => {
  if (!stats.value) return []

  return [
    {
      title: 'Fleet Compliance',
      value: formatPercent(stats.value.rates.fleetComplianceRate),
      icon: 'i-lucide-shield-check',
      color: stats.value.rates.fleetComplianceRate >= 80 ? 'success' : 'warning',
      description: `${stats.value.summary.assetsInspected} of ${stats.value.summary.totalAssets} assets inspected`,
    },
    {
      title: 'Pass Rate',
      value: formatPercent(stats.value.rates.passRate),
      icon: 'i-lucide-check-circle',
      color:
        stats.value.rates.passRate >= 90
          ? 'success'
          : stats.value.rates.passRate >= 70
            ? 'warning'
            : 'error',
      description: `${stats.value.summary.passCount} passed, ${stats.value.summary.failCount} failed`,
    },
    {
      title: 'Total Inspections',
      value: stats.value.summary.totalInspections,
      icon: 'i-lucide-clipboard-check',
      color: 'info',
      description: `${stats.value.summary.completedInspections} completed`,
    },
    {
      title: 'Open Defects',
      value: stats.value.summary.openDefects,
      icon: 'i-lucide-alert-triangle',
      color:
        stats.value.summary.criticalDefects > 0
          ? 'error'
          : stats.value.summary.openDefects > 0
            ? 'warning'
            : 'success',
      description: `${stats.value.summary.criticalDefects} critical, ${stats.value.summary.majorDefects} major`,
    },
  ]
})

// Status breakdown for donut-style display
const statusBreakdown = computed(() => {
  if (!stats.value?.byStatus) return []
  const statusColors: Record<string, string> = {
    completed: 'bg-success',
    in_progress: 'bg-warning',
    cancelled: 'bg-neutral',
  }
  const statusLabels: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    cancelled: 'Cancelled',
  }
  return stats.value.byStatus.map((s) => ({
    label: statusLabels[s.status] || s.status,
    value: s.count,
    color: statusColors[s.status] || 'bg-neutral',
  }))
})

// Severity colors
const severityColors: Record<string, string> = {
  critical: 'error',
  major: 'warning',
  minor: 'neutral',
}

// Quick date range presets
function setDateRange(days: number) {
  endDate.value = new Date()
  startDate.value = sub(new Date(), { days })
}

// Export handler
function exportReport() {
  const params = new URLSearchParams()
  params.set('format', 'csv')
  params.set('startDate', format(startDate.value, 'yyyy-MM-dd'))
  params.set('endDate', format(endDate.value, 'yyyy-MM-dd'))
  window.open(`/api/inspections/export?${params.toString()}`, '_blank')
}
</script>

<template>
  <UDashboardPanel id="inspection-compliance">
    <template #header>
      <UDashboardNavbar title="Compliance Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButtonGroup>
              <UButton
                label="7 Days"
                :color="startDate.getTime() === sub(new Date(), { days: 7 }).setHours(0, 0, 0, 0) ? 'primary' : 'neutral'"
                variant="soft"
                size="sm"
                @click="setDateRange(7)"
              />
              <UButton
                label="30 Days"
                :color="startDate.getTime() === sub(new Date(), { days: 30 }).setHours(0, 0, 0, 0) ? 'primary' : 'neutral'"
                variant="soft"
                size="sm"
                @click="setDateRange(30)"
              />
              <UButton
                label="90 Days"
                :color="startDate.getTime() === sub(new Date(), { days: 90 }).setHours(0, 0, 0, 0) ? 'primary' : 'neutral'"
                variant="soft"
                size="sm"
                @click="setDateRange(90)"
              />
            </UButtonGroup>
            <UButton
              label="View History"
              icon="i-lucide-list"
              color="neutral"
              variant="outline"
              @click="router.push('/inspections/history')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="statsStatus === 'pending'" class="flex items-center justify-center py-20">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <template v-else>
        <!-- Summary Cards -->
        <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px mb-6">
          <UPageCard
            v-for="(card, index) in summaryCards"
            :key="index"
            :icon="card.icon"
            :title="card.title"
            variant="subtle"
            :ui="{
              container: 'gap-y-1.5',
              wrapper: 'items-start',
              leading: `p-2.5 rounded-full bg-${card.color}/10 ring ring-inset ring-${card.color}/25 flex-col`,
              title: 'font-normal text-muted text-xs uppercase',
            }"
            class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
          >
            <div class="flex items-center gap-2">
              <span class="text-2xl font-semibold text-highlighted">
                {{ card.value }}
              </span>
            </div>
            <p v-if="card.description" class="text-sm text-muted mt-1">
              {{ card.description }}
            </p>
          </UPageCard>
        </UPageGrid>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Inspection Status Breakdown -->
          <UCard>
            <template #header>
              <h3 class="font-semibold text-highlighted">Inspection Status</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="item in statusBreakdown"
                :key="item.label"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <div :class="[item.color, 'w-3 h-3 rounded-full']" />
                  <span>{{ item.label }}</span>
                </div>
                <span class="font-medium">{{ item.value }}</span>
              </div>
            </div>

            <div v-if="!statusBreakdown.length" class="text-center text-muted py-8">
              No inspections in this period
            </div>
          </UCard>

          <!-- Open Defects by Severity -->
          <UCard>
            <template #header>
              <h3 class="font-semibold text-highlighted">Open Defects by Severity</h3>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UBadge color="error" variant="subtle">Critical</UBadge>
                </div>
                <span class="text-2xl font-bold text-error">
                  {{ stats?.summary.criticalDefects || 0 }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UBadge color="warning" variant="subtle">Major</UBadge>
                </div>
                <span class="text-2xl font-bold text-warning">
                  {{ stats?.summary.majorDefects || 0 }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UBadge color="neutral" variant="subtle">Minor</UBadge>
                </div>
                <span class="text-2xl font-bold">
                  {{ stats?.summary.minorDefects || 0 }}
                </span>
              </div>
            </div>

            <template #footer>
              <UButton
                label="View All Defects"
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-arrow-right"
                block
                @click="router.push('/defects')"
              />
            </template>
          </UCard>

          <!-- Top Templates -->
          <UCard>
            <template #header>
              <h3 class="font-semibold text-highlighted">Most Used Templates</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="(template, index) in stats?.topTemplates || []"
                :key="template.templateId"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span class="text-muted">{{ index + 1 }}.</span>
                  <span class="truncate max-w-[200px]">{{ template.templateName }}</span>
                </div>
                <UBadge color="neutral" variant="soft">
                  {{ template.count }}
                </UBadge>
              </div>
            </div>

            <div
              v-if="!stats?.topTemplates?.length"
              class="text-center text-muted py-8"
            >
              No inspections in this period
            </div>
          </UCard>

          <!-- Assets with Most Failures -->
          <UCard>
            <template #header>
              <h3 class="font-semibold text-highlighted">Assets with Most Failures</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="asset in stats?.assetsWithMostFailures || []"
                :key="asset.assetId"
                class="flex items-center justify-between"
              >
                <div>
                  <p class="font-medium">{{ asset.assetNumber }}</p>
                  <p class="text-sm text-muted">
                    {{ asset.make || '' }} {{ asset.model || '' }}
                  </p>
                </div>
                <UBadge color="error" variant="subtle">
                  {{ asset.failedCount }} failures
                </UBadge>
              </div>
            </div>

            <div
              v-if="!stats?.assetsWithMostFailures?.length"
              class="text-center text-muted py-8"
            >
              No failed inspections in this period
            </div>

            <template v-if="stats?.assetsWithMostFailures?.length" #footer>
              <UButton
                label="View Full History"
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-arrow-right"
                block
                @click="router.push('/inspections/history?overallResult=fail')"
              />
            </template>
          </UCard>
        </div>

        <!-- Trends Section -->
        <div class="mt-6">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-highlighted">Defect Trends</h3>
                <span class="text-sm text-muted">
                  {{ format(startDate, 'MMM d') }} - {{ format(endDate, 'MMM d, yyyy') }}
                </span>
              </div>
            </template>

            <!-- Common Failure Points -->
            <div v-if="trends?.commonFailures?.length" class="mb-6">
              <h4 class="text-sm font-medium text-muted mb-3">Common Failure Points</h4>
              <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div
                  v-for="failure in trends.commonFailures.slice(0, 5)"
                  :key="failure.checklistItem"
                  class="p-3 bg-elevated rounded-lg"
                >
                  <p class="text-sm font-medium truncate" :title="failure.checklistItem">
                    {{ failure.checklistItem }}
                  </p>
                  <p class="text-2xl font-bold text-error">{{ failure.count }}</p>
                </div>
              </div>
            </div>

            <!-- Defect Categories -->
            <div v-if="trends?.defectCategories?.length">
              <h4 class="text-sm font-medium text-muted mb-3">Defects by Category</h4>
              <div class="space-y-2">
                <div
                  v-for="cat in trends.defectCategories"
                  :key="cat.category"
                  class="flex items-center gap-3"
                >
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm">{{ cat.category }}</span>
                      <span class="text-sm font-medium">{{ cat.count }}</span>
                    </div>
                    <UProgress
                      :value="(cat.count / (trends.defectCategories[0]?.count || 1)) * 100"
                      color="primary"
                      size="xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="!trends?.commonFailures?.length && !trends?.defectCategories?.length"
              class="text-center text-muted py-12"
            >
              <UIcon name="i-lucide-check-circle-2" class="w-12 h-12 mx-auto mb-3 text-success" />
              <p>No defects reported in this period</p>
            </div>
          </UCard>
        </div>

        <!-- Export Section -->
        <div class="mt-6 flex justify-end">
          <UButton
            label="Export Full Report"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            @click="exportReport"
          />
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
