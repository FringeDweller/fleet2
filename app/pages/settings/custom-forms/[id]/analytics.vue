<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface StatusBreakdown {
  status: string
  count: number
  percentage: number
}

interface DateCount {
  date: string
  count: number
}

interface FieldDistribution {
  value: string
  count: number
  percentage: number
}

interface FieldStats {
  fieldId: string
  label: string
  fieldType: string
  distribution: FieldDistribution[]
  completionRate: number
}

interface TopSubmitter {
  userId: string | null
  name: string
  count: number
}

interface FormStats {
  totalSubmissions: number
  statusBreakdown: StatusBreakdown[]
  submissionsByDate: DateCount[]
  completionRateOverall: number
  averageCompletionTime: number | null
  fieldStats: FieldStats[]
  topSubmitters: TopSubmitter[]
}

interface StatsResponse {
  form: {
    id: string
    name: string
    status: string
    version: number
  }
  stats: FormStats
  dateRange: {
    from: string
    to: string
  }
}

const route = useRoute()
const router = useRouter()
const formId = route.params.id as string

// Date range filter
const dateRange = ref<'7d' | '30d' | '90d' | 'all'>('30d')
const customDateFrom = ref<string | undefined>(undefined)
const customDateTo = ref<string | undefined>(undefined)

// Compute date range params
const dateParams = computed(() => {
  const now = new Date()
  let from: string | undefined
  let to: string | undefined

  switch (dateRange.value) {
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
      break
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
      break
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
      break
    case 'all':
      from = undefined
      to = undefined
      break
  }

  if (customDateFrom.value) from = new Date(customDateFrom.value).toISOString()
  if (customDateTo.value) to = new Date(customDateTo.value).toISOString()

  return { dateFrom: from, dateTo: to }
})

const { data: statsData, status } = await useFetch<StatsResponse>(
  `/api/custom-forms/${formId}/stats`,
  {
    query: computed(() => dateParams.value),
    lazy: true,
  },
)

const form = computed(() => statsData.value?.form)
const stats = computed(() => statsData.value?.stats)

const dateRangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time', value: 'all' },
]

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-'

  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins}m`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  } else {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    return `${days}d ${hours}h`
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'submitted':
      return 'bg-info'
    case 'approved':
      return 'bg-success'
    case 'rejected':
      return 'bg-error'
    case 'draft':
      return 'bg-warning'
    default:
      return 'bg-muted'
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'submitted':
      return 'info'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    case 'draft':
      return 'warning'
    default:
      return 'neutral'
  }
}

// Simple chart rendering using div bars
function getBarWidth(percentage: number): string {
  return `${Math.max(percentage, 2)}%`
}
</script>

<template>
  <UDashboardPanel id="form-analytics">
    <template #header>
      <UDashboardNavbar :title="`${form?.name || 'Form'} Analytics`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/settings/custom-forms/${formId}`)"
          />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="View Responses"
              icon="i-lucide-list"
              color="neutral"
              variant="soft"
              @click="router.push(`/settings/custom-forms/${formId}/responses`)"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Date Range Filter -->
      <div class="p-4 border-b border-default flex items-center gap-4">
        <span class="text-sm text-muted">Date Range:</span>
        <USelect
          v-model="dateRange"
          :items="dateRangeOptions"
          class="w-40"
        />
        <div v-if="dateRange === 'all'" class="flex items-center gap-2">
          <UInput
            v-model="customDateFrom"
            type="date"
            placeholder="From"
            class="w-40"
          />
          <span class="text-muted">to</span>
          <UInput
            v-model="customDateTo"
            type="date"
            placeholder="To"
            class="w-40"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Stats -->
      <div v-else-if="stats" class="p-6 space-y-6">
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Submissions -->
          <UPageCard variant="subtle">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-primary/10 rounded-lg">
                <UIcon name="i-lucide-file-text" class="w-6 h-6 text-primary" />
              </div>
              <div>
                <p class="text-sm text-muted">Total Submissions</p>
                <p class="text-2xl font-semibold">{{ stats.totalSubmissions }}</p>
              </div>
            </div>
          </UPageCard>

          <!-- Completion Rate -->
          <UPageCard variant="subtle">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-success/10 rounded-lg">
                <UIcon name="i-lucide-check-circle" class="w-6 h-6 text-success" />
              </div>
              <div>
                <p class="text-sm text-muted">Completion Rate</p>
                <p class="text-2xl font-semibold">{{ stats.completionRateOverall }}%</p>
              </div>
            </div>
          </UPageCard>

          <!-- Average Completion Time -->
          <UPageCard variant="subtle">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-info/10 rounded-lg">
                <UIcon name="i-lucide-clock" class="w-6 h-6 text-info" />
              </div>
              <div>
                <p class="text-sm text-muted">Avg. Completion Time</p>
                <p class="text-2xl font-semibold">
                  {{ formatDuration(stats.averageCompletionTime) }}
                </p>
              </div>
            </div>
          </UPageCard>

          <!-- Pending Review -->
          <UPageCard variant="subtle">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-warning/10 rounded-lg">
                <UIcon name="i-lucide-hourglass" class="w-6 h-6 text-warning" />
              </div>
              <div>
                <p class="text-sm text-muted">Pending Review</p>
                <p class="text-2xl font-semibold">
                  {{ stats.statusBreakdown.find((s: StatusBreakdown) => s.status === 'submitted')?.count || 0 }}
                </p>
              </div>
            </div>
          </UPageCard>
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Status Breakdown -->
          <UPageCard>
            <template #header>
              <h3 class="font-medium">Status Breakdown</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="statusItem in stats.statusBreakdown"
                :key="statusItem.status"
                class="flex items-center gap-3"
              >
                <UBadge
                  :color="getStatusBadgeColor(statusItem.status)"
                  variant="subtle"
                  class="w-24 justify-center capitalize"
                >
                  {{ statusItem.status }}
                </UBadge>
                <div class="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    :class="getStatusColor(statusItem.status)"
                    class="h-full rounded-full transition-all duration-500"
                    :style="{ width: getBarWidth(statusItem.percentage) }"
                  />
                </div>
                <span class="text-sm font-medium w-16 text-right">
                  {{ statusItem.count }} ({{ statusItem.percentage }}%)
                </span>
              </div>
            </div>
          </UPageCard>

          <!-- Submissions Over Time -->
          <UPageCard>
            <template #header>
              <h3 class="font-medium">Submissions Over Time</h3>
            </template>

            <div v-if="stats.submissionsByDate.length === 0" class="text-center py-8 text-muted">
              No submissions in this period
            </div>
            <div v-else class="h-48 flex items-end gap-1">
              <div
                v-for="day in stats.submissionsByDate"
                :key="day.date"
                class="flex-1 flex flex-col items-center gap-1 group relative"
              >
                <div
                  class="w-full bg-primary rounded-t transition-all duration-300 min-h-[4px]"
                  :style="{
                    height: `${Math.max((day.count / Math.max(...stats.submissionsByDate.map((d: DateCount) => d.count))) * 100, 2)}%`
                  }"
                />
                <!-- Tooltip -->
                <div
                  class="absolute bottom-full mb-2 px-2 py-1 bg-inverted text-inverted text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                >
                  {{ day.date }}: {{ day.count }} submissions
                </div>
              </div>
            </div>
            <div class="flex justify-between mt-2 text-xs text-muted">
              <span>{{ stats.submissionsByDate[0]?.date || '' }}</span>
              <span>{{ stats.submissionsByDate[stats.submissionsByDate.length - 1]?.date || '' }}</span>
            </div>
          </UPageCard>
        </div>

        <!-- Field Statistics -->
        <UPageCard v-if="stats.fieldStats.length > 0">
          <template #header>
            <h3 class="font-medium">Field Response Distribution</h3>
          </template>

          <div class="space-y-6">
            <div
              v-for="fieldStat in stats.fieldStats"
              :key="fieldStat.fieldId"
              class="border-b border-default pb-6 last:border-0 last:pb-0"
            >
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h4 class="font-medium">{{ fieldStat.label }}</h4>
                  <p class="text-sm text-muted">
                    {{ fieldStat.fieldType }} field - {{ fieldStat.completionRate }}% completion
                  </p>
                </div>
              </div>

              <div v-if="fieldStat.distribution.length === 0" class="text-sm text-muted">
                No responses recorded
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="item in fieldStat.distribution"
                  :key="item.value"
                  class="flex items-center gap-3"
                >
                  <span class="w-32 text-sm truncate" :title="item.value">
                    {{ item.value }}
                  </span>
                  <div class="flex-1 h-4 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary rounded-full transition-all duration-500"
                      :style="{ width: getBarWidth(item.percentage) }"
                    />
                  </div>
                  <span class="text-sm w-20 text-right">
                    {{ item.count }} ({{ item.percentage }}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Top Submitters -->
        <UPageCard v-if="stats.topSubmitters.length > 0">
          <template #header>
            <h3 class="font-medium">Top Submitters</h3>
          </template>

          <div class="divide-y divide-default">
            <div
              v-for="(submitter, index) in stats.topSubmitters"
              :key="submitter.userId || index"
              class="flex items-center justify-between py-3"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {{ index + 1 }}
                </div>
                <span>{{ submitter.name }}</span>
              </div>
              <div class="flex items-center gap-4">
                <div class="w-24 h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full"
                    :style="{
                      width: `${(submitter.count / (stats.topSubmitters[0]?.count || 1)) * 100}%`
                    }"
                  />
                </div>
                <span class="text-sm font-medium w-16 text-right">
                  {{ submitter.count }} submissions
                </span>
              </div>
            </div>
          </div>
        </UPageCard>
      </div>

      <!-- No data state -->
      <div v-else class="text-center py-12">
        <UIcon name="i-lucide-bar-chart-3" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
        <p class="text-lg font-medium mb-2">No analytics available</p>
        <p class="text-muted">
          Analytics will appear once form submissions are recorded.
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
