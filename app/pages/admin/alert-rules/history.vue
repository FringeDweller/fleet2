<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

interface Alert {
  id: string
  type: string
  subType: string
  title: string
  description: string
  asset: { id: string; assetNumber: string; name: string | null } | null
  geofence: { id: string; name: string } | null
  location: { latitude: string; longitude: string }
  alertedAt: string
  isAcknowledged: boolean
  acknowledgedAt: string | null
  acknowledgedBy: { id: string; name: string } | null
}

interface AlertsResponse {
  alerts: Alert[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Filters
const currentPage = ref(Number(route.query.page) || 1)
const selectedType = ref((route.query.type as string) || '')
const selectedAcknowledged = ref((route.query.acknowledged as string) || 'all')
const startDate = ref((route.query.startDate as string) || '')
const endDate = ref((route.query.endDate as string) || '')

// Build query params
const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    page: currentPage.value,
    limit: 20,
  }
  if (selectedType.value) params.type = selectedType.value
  if (selectedAcknowledged.value !== 'all') params.acknowledged = selectedAcknowledged.value
  if (startDate.value) params.startDate = startDate.value
  if (endDate.value) params.endDate = endDate.value
  return params
})

// Fetch alerts
const {
  data: alertsData,
  status,
  refresh,
} = await useFetch<AlertsResponse>('/api/admin/alerts/history', {
  query: queryParams,
  watch: [queryParams],
  default: () => ({
    alerts: [],
    pagination: {
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
    },
  }),
})

// Alert type options
const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Geofence Entry', value: 'entry' },
  { label: 'Geofence Exit', value: 'exit' },
  { label: 'After-Hours Movement', value: 'after_hours_movement' },
]

const acknowledgedOptions = [
  { label: 'All', value: 'all' },
  { label: 'Acknowledged', value: 'true' },
  { label: 'Unacknowledged', value: 'false' },
]

// Update URL when filters change
watch([selectedType, selectedAcknowledged, startDate, endDate], () => {
  currentPage.value = 1
  updateUrl()
})

watch(currentPage, () => {
  updateUrl()
})

function updateUrl() {
  const query: Record<string, string | number> = {}
  if (currentPage.value > 1) query.page = currentPage.value
  if (selectedType.value) query.type = selectedType.value
  if (selectedAcknowledged.value !== 'all') query.acknowledged = selectedAcknowledged.value
  if (startDate.value) query.startDate = startDate.value
  if (endDate.value) query.endDate = endDate.value
  router.replace({ query })
}

// Get alert icon
function getAlertIcon(subType: string): string {
  switch (subType) {
    case 'entry':
      return 'i-lucide-log-in'
    case 'exit':
      return 'i-lucide-log-out'
    case 'after_hours_movement':
      return 'i-lucide-moon'
    default:
      return 'i-lucide-alert-circle'
  }
}

// Get alert color
function getAlertColor(subType: string): string {
  switch (subType) {
    case 'entry':
      return 'success'
    case 'exit':
      return 'primary'
    case 'after_hours_movement':
      return 'warning'
    default:
      return 'neutral'
  }
}

// Acknowledge alert
async function acknowledgeAlert(alert: Alert) {
  if (alert.isAcknowledged) return

  try {
    await $fetch(`/api/geofence-alerts/${alert.id}/acknowledge`, {
      method: 'POST',
    })
    toast.add({
      title: 'Alert acknowledged',
      color: 'success',
    })
    await refresh()
  } catch (error) {
    console.error('Failed to acknowledge alert:', error)
    toast.add({
      title: 'Failed to acknowledge',
      color: 'error',
    })
  }
}

// Clear filters
function clearFilters() {
  selectedType.value = ''
  selectedAcknowledged.value = 'all'
  startDate.value = ''
  endDate.value = ''
  currentPage.value = 1
}
</script>

<template>
  <UDashboardPanel id="alert-history">
    <template #header>
      <UDashboardNavbar title="Alert History">
        <template #leading>
          <UButton
            to="/admin/alert-rules"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            class="mr-2"
          />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex flex-wrap items-center gap-3">
            <USelectMenu
              v-model="selectedType"
              :items="typeOptions"
              value-key="value"
              placeholder="Alert Type"
              class="w-44"
            />

            <USelectMenu
              v-model="selectedAcknowledged"
              :items="acknowledgedOptions"
              value-key="value"
              placeholder="Status"
              class="w-40"
            />

            <UInput
              v-model="startDate"
              type="date"
              placeholder="Start Date"
              class="w-36"
            />

            <UInput
              v-model="endDate"
              type="date"
              placeholder="End Date"
              class="w-36"
            />

            <UButton
              v-if="selectedType || selectedAcknowledged !== 'all' || startDate || endDate"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="clearFilters"
            >
              Clear
            </UButton>
          </div>
        </template>

        <template #right>
          <span class="text-sm text-muted">
            {{ alertsData?.pagination.totalCount ?? 0 }} alerts
          </span>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!alertsData?.alerts.length"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon name="i-lucide-bell-off" class="size-12 text-muted mb-4" />
        <h3 class="text-lg font-semibold">No alerts found</h3>
        <p class="text-muted mt-1">
          {{ selectedType || startDate || endDate ? 'Try adjusting your filters' : 'Alerts will appear here when triggered' }}
        </p>
      </div>

      <!-- Alert list -->
      <div v-else class="space-y-3">
        <div
          v-for="alert in alertsData?.alerts"
          :key="alert.id"
          class="p-4 rounded-lg border border-default hover:bg-elevated/50 transition-colors"
          :class="{ 'opacity-60': alert.isAcknowledged }"
        >
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="shrink-0 size-10 rounded-full flex items-center justify-center"
              :class="{
                'bg-success/10 text-success': getAlertColor(alert.subType) === 'success',
                'bg-primary/10 text-primary': getAlertColor(alert.subType) === 'primary',
                'bg-warning/10 text-warning': getAlertColor(alert.subType) === 'warning',
                'bg-default text-muted': getAlertColor(alert.subType) === 'neutral',
              }"
            >
              <UIcon :name="getAlertIcon(alert.subType)" class="size-5" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold">{{ alert.title }}</h3>
                <UBadge
                  v-if="!alert.isAcknowledged"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  Unacknowledged
                </UBadge>
              </div>
              <p class="text-sm text-muted mt-0.5">{{ alert.description }}</p>

              <div class="flex flex-wrap items-center gap-4 mt-2 text-sm">
                <div class="flex items-center gap-1 text-muted">
                  <UIcon name="i-lucide-clock" class="size-4" />
                  <span>{{ formatDistanceToNow(new Date(alert.alertedAt), { addSuffix: true }) }}</span>
                </div>

                <NuxtLink
                  v-if="alert.asset"
                  :to="`/assets/${alert.asset.id}`"
                  class="flex items-center gap-1 text-primary hover:underline"
                >
                  <UIcon name="i-lucide-truck" class="size-4" />
                  <span>{{ alert.asset.assetNumber }}</span>
                </NuxtLink>

                <NuxtLink
                  v-if="alert.geofence"
                  :to="`/geofences/${alert.geofence.id}`"
                  class="flex items-center gap-1 text-primary hover:underline"
                >
                  <UIcon name="i-lucide-map-pin" class="size-4" />
                  <span>{{ alert.geofence.name }}</span>
                </NuxtLink>
              </div>

              <div v-if="alert.isAcknowledged && alert.acknowledgedBy" class="mt-2 text-xs text-muted">
                Acknowledged by {{ alert.acknowledgedBy.name }}
                {{ alert.acknowledgedAt ? formatDistanceToNow(new Date(alert.acknowledgedAt), { addSuffix: true }) : '' }}
              </div>
            </div>

            <!-- Actions -->
            <div class="shrink-0">
              <UButton
                v-if="!alert.isAcknowledged"
                variant="soft"
                color="primary"
                size="sm"
                icon="i-lucide-check"
                @click="acknowledgeAlert(alert)"
              >
                Acknowledge
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="alertsData && alertsData.pagination.totalPages > 1"
        class="flex items-center justify-center gap-2 mt-6"
      >
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-left"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        />
        <span class="text-sm">
          Page {{ currentPage }} of {{ alertsData.pagination.totalPages }}
        </span>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-right"
          :disabled="!alertsData.pagination.hasMore"
          @click="currentPage++"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
