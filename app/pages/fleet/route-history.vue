<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import type { Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

const toast = useToast()
const router = useRouter()
const route = useRoute()

// Date formatter
const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

const dtf = new DateFormatter('en-US', {
  dateStyle: 'short',
  timeStyle: 'short',
})

// Types
interface RoutePoint {
  id: string
  operatorSessionId: string
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  speed: number | null
  heading: number | null
  recordedAt: string
}

interface RouteSession {
  id: string
  startTime: string
  endTime: string | null
  status: string
  operator: { id: string; name: string } | null
  tripDistance: string | null
  tripDurationMinutes: number | null
  startLocationName: string | null
  endLocationName: string | null
}

interface RouteStop {
  latitude: number
  longitude: number
  startTime: string
  endTime: string
  durationMinutes: number
}

interface RouteStatistics {
  totalPoints: number
  totalDistanceKm: number
  totalSessions: number
  totalStops: number
  maxSpeedKmh: number
  avgSpeedKmh: number
}

interface RouteHistoryResponse {
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    imageUrl: string | null
  }
  dateRange: { start: string; end: string }
  sessions: RouteSession[]
  route: RoutePoint[]
  stops: RouteStop[]
  statistics: RouteStatistics
}

// State
const selectedAssetId = ref<string>('')
const dateRange = ref<Range>({
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: last 7 days
  end: new Date(),
})
const isPlaying = ref(false)
const playbackSpeed = ref(1)
const playbackProgress = ref(0)
const currentPointIndex = ref(0)
const routeData = ref<RouteHistoryResponse | null>(null)
const routeStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

// Playback interval
let playbackInterval: ReturnType<typeof setInterval> | null = null

// Fetch assets for selector
const { data: assetsData, status: assetsStatus } = useFetch<{
  data: Array<{
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    imageUrl: string | null
    status: string
  }>
  pagination: { total: number }
}>('/api/assets', {
  query: {
    limit: 100,
    status: 'active',
  },
  lazy: true,
})

const assets = computed(() => assetsData.value?.data || [])

// Asset options for selector
const assetOptions = computed(() =>
  assets.value.map((a) => ({
    label: `${a.assetNumber} - ${[a.year, a.make, a.model].filter(Boolean).join(' ')}`,
    value: a.id,
  })),
)

// Fetch route history manually
async function fetchRouteHistory() {
  if (!selectedAssetId.value) return

  routeStatus.value = 'pending'
  try {
    const data = await $fetch<RouteHistoryResponse>(
      `/api/assets/${selectedAssetId.value}/route-history`,
      {
        query: {
          dateFrom: dateRange.value.start.toISOString(),
          dateTo: dateRange.value.end.toISOString(),
        },
      },
    )
    routeData.value = data
    routeStatus.value = 'success'
  } catch (error) {
    console.error('Failed to fetch route history:', error)
    routeStatus.value = 'error'
    routeData.value = null
  }
}

// Watch for asset changes to fetch route
watch(
  [selectedAssetId, dateRange],
  () => {
    if (selectedAssetId.value) {
      stopPlayback()
      currentPointIndex.value = 0
      playbackProgress.value = 0
      fetchRouteHistory()
    }
  },
  { deep: true },
)

// Initialize from route query params
onMounted(() => {
  const assetParam = route.query.asset as string
  if (assetParam) {
    selectedAssetId.value = assetParam
  }
})

// Computed data
const routePoints = computed<RoutePoint[]>(() => routeData.value?.route || [])
const sessions = computed<RouteSession[]>(() => routeData.value?.sessions || [])
const stops = computed<RouteStop[]>(() => routeData.value?.stops || [])
const statistics = computed<RouteStatistics | null>(() => routeData.value?.statistics || null)
const asset = computed(() => routeData.value?.asset || null)

// Current point during playback
const currentPoint = computed<RoutePoint | null>(() => {
  if (routePoints.value.length === 0) return null
  return routePoints.value[currentPointIndex.value] || null
})

// Map bounds from route points
const mapBounds = computed(() => {
  if (routePoints.value.length === 0) return null
  const lats = routePoints.value.map((p: RoutePoint) => p.latitude)
  const lngs = routePoints.value.map((p: RoutePoint) => p.longitude)
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  }
})

// Map center
const mapCenter = computed(() => {
  if (routePoints.value.length === 0) {
    return { lat: -27.4705, lng: 153.026 } // Default: Brisbane
  }
  const sumLat = routePoints.value.reduce((sum: number, p: RoutePoint) => sum + p.latitude, 0)
  const sumLng = routePoints.value.reduce((sum: number, p: RoutePoint) => sum + p.longitude, 0)
  return {
    lat: sumLat / routePoints.value.length,
    lng: sumLng / routePoints.value.length,
  }
})

// Playback controls
function startPlayback() {
  if (routePoints.value.length === 0) return
  isPlaying.value = true

  const intervalMs = 1000 / playbackSpeed.value
  playbackInterval = setInterval(() => {
    if (currentPointIndex.value < routePoints.value.length - 1) {
      currentPointIndex.value++
      playbackProgress.value = (currentPointIndex.value / (routePoints.value.length - 1)) * 100
    } else {
      stopPlayback()
    }
  }, intervalMs)
}

function stopPlayback() {
  isPlaying.value = false
  if (playbackInterval) {
    clearInterval(playbackInterval)
    playbackInterval = null
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    if (currentPointIndex.value >= routePoints.value.length - 1) {
      currentPointIndex.value = 0
      playbackProgress.value = 0
    }
    startPlayback()
  }
}

function resetPlayback() {
  stopPlayback()
  currentPointIndex.value = 0
  playbackProgress.value = 0
}

function setPlaybackPosition(value: number) {
  stopPlayback()
  currentPointIndex.value = Math.round((value / 100) * (routePoints.value.length - 1))
  playbackProgress.value = value
}

// Cleanup on unmount
onUnmounted(() => {
  stopPlayback()
})

// Watch playback speed changes
watch(playbackSpeed, () => {
  if (isPlaying.value) {
    stopPlayback()
    startPlayback()
  }
})

// Speed options
const speedOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
]

// Date range picker helpers
const toCalendarDate = (date: Date) => {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

const calendarRange = computed({
  get: () => ({
    start: dateRange.value.start ? toCalendarDate(dateRange.value.start) : undefined,
    end: dateRange.value.end ? toCalendarDate(dateRange.value.end) : undefined,
  }),
  set: (newValue: { start: CalendarDate | null; end: CalendarDate | null }) => {
    dateRange.value = {
      start: newValue.start ? newValue.start.toDate(getLocalTimeZone()) : new Date(),
      end: newValue.end ? newValue.end.toDate(getLocalTimeZone()) : new Date(),
    }
  },
})

const dateRangePresets = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1, offset: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
]

function selectDatePreset(preset: { days: number; offset?: number }) {
  const end = new Date()
  if (preset.offset) {
    end.setDate(end.getDate() - preset.offset)
  }
  const start = new Date(end)
  start.setDate(start.getDate() - preset.days)
  dateRange.value = { start, end }
}

// Export function
function exportRouteData(format: 'json' | 'csv') {
  if (!routeData.value) return

  let content: string
  let filename: string
  let mimeType: string

  if (format === 'json') {
    content = JSON.stringify(routeData.value, null, 2)
    filename = `route-history-${asset.value?.assetNumber || 'unknown'}-${df.format(dateRange.value.start)}-${df.format(dateRange.value.end)}.json`
    mimeType = 'application/json'
  } else {
    // CSV format
    const headers = ['Time', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading', 'Altitude']
    const rows = routePoints.value.map((p: RoutePoint) => [
      p.recordedAt,
      p.latitude,
      p.longitude,
      p.speed ?? '',
      p.heading ?? '',
      p.altitude ?? '',
    ])
    content = [headers.join(','), ...rows.map((r: (string | number | null)[]) => r.join(','))].join(
      '\n',
    )
    filename = `route-history-${asset.value?.assetNumber || 'unknown'}-${df.format(dateRange.value.start)}-${df.format(dateRange.value.end)}.csv`
    mimeType = 'text/csv'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.add({
    title: `Route data exported as ${format.toUpperCase()}`,
    icon: 'i-lucide-download',
  })
}

// Get position on map (simple projection)
function getMarkerPosition(lat: number, lng: number) {
  if (!mapBounds.value) {
    return { left: '50%', top: '50%' }
  }

  const bounds = mapBounds.value
  const latRange = bounds.north - bounds.south || 0.01
  const lngRange = bounds.east - bounds.west || 0.01

  const padding = 0.1
  const paddedLatRange = latRange * (1 + padding * 2)
  const paddedLngRange = lngRange * (1 + padding * 2)
  const paddedSouth = bounds.south - latRange * padding
  const paddedWest = bounds.west - lngRange * padding

  const xPercent = ((lng - paddedWest) / paddedLngRange) * 100
  const yPercent = ((bounds.north + latRange * padding - lat) / paddedLatRange) * 100

  return {
    left: `${Math.max(2, Math.min(98, xPercent))}%`,
    top: `${Math.max(2, Math.min(98, yPercent))}%`,
  }
}

// Format duration
function formatDuration(minutes: number | null) {
  if (!minutes) return '-'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Timeline item click handler
function jumpToSession(session: RouteSession) {
  const sessionPoints = routePoints.value.filter(
    (p: RoutePoint) => p.operatorSessionId === session.id,
  )
  if (sessionPoints.length > 0) {
    const firstPoint = sessionPoints[0]
    const index = routePoints.value.findIndex((p: RoutePoint) => p.id === firstPoint?.id)
    if (index >= 0) {
      stopPlayback()
      currentPointIndex.value = index
      playbackProgress.value = (index / (routePoints.value.length - 1)) * 100
    }
  }
}
</script>

<template>
  <UDashboardPanel id="route-history">
    <template #header>
      <UDashboardNavbar title="Vehicle Route History">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <!-- Back to Fleet Map -->
            <UButton
              icon="i-lucide-map"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="router.push('/fleet/map')"
            >
              Fleet Map
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-4">
        <!-- Filters -->
        <UCard>
          <div class="flex flex-wrap items-end gap-4">
            <!-- Vehicle Selector -->
            <div class="flex-1 min-w-64">
              <label class="block text-sm font-medium text-muted mb-1.5">Select Vehicle</label>
              <USelect
                v-model="selectedAssetId"
                :items="assetOptions"
                placeholder="Choose a vehicle..."
                :loading="assetsStatus === 'pending'"
                searchable
                searchable-placeholder="Search vehicles..."
                class="w-full"
              />
            </div>

            <!-- Date Range Picker -->
            <div class="min-w-72">
              <label class="block text-sm font-medium text-muted mb-1.5">Date Range</label>
              <UPopover :content="{ align: 'start' }" :modal="true">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="w-full justify-start"
                >
                  {{ df.format(dateRange.start) }} - {{ df.format(dateRange.end) }}
                </UButton>

                <template #content>
                  <div class="flex items-stretch sm:divide-x divide-default">
                    <div class="hidden sm:flex flex-col justify-center">
                      <UButton
                        v-for="(preset, index) in dateRangePresets"
                        :key="index"
                        :label="preset.label"
                        color="neutral"
                        variant="ghost"
                        class="rounded-none px-4"
                        truncate
                        @click="selectDatePreset(preset)"
                      />
                    </div>

                    <UCalendar
                      v-model="calendarRange"
                      class="p-2"
                      :number-of-months="2"
                      range
                    />
                  </div>
                </template>
              </UPopover>
            </div>

            <!-- Export Button -->
            <UDropdownMenu
              :items="[
                [
                  { label: 'Export as JSON', icon: 'i-lucide-file-json', click: () => exportRouteData('json') },
                  { label: 'Export as CSV', icon: 'i-lucide-file-spreadsheet', click: () => exportRouteData('csv') },
                ],
              ]"
            >
              <UButton
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                :disabled="!routeData || routePoints.length === 0"
              >
                Export
              </UButton>
            </UDropdownMenu>
          </div>
        </UCard>

        <!-- Loading State -->
        <div v-if="routeStatus === 'pending'" class="flex items-center justify-center py-12">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p class="text-muted">Loading route data...</p>
          </div>
        </div>

        <!-- No Vehicle Selected -->
        <div v-else-if="!selectedAssetId" class="text-center py-12">
          <UIcon name="i-lucide-truck" class="w-16 h-16 mx-auto mb-4 text-muted opacity-50" />
          <h3 class="text-lg font-medium text-highlighted mb-2">Select a Vehicle</h3>
          <p class="text-muted text-sm max-w-md mx-auto">
            Choose a vehicle from the dropdown above to view its route history.
          </p>
        </div>

        <!-- No Data State -->
        <div v-else-if="routeData && routePoints.length === 0" class="text-center py-12">
          <UIcon name="i-lucide-map-pin-off" class="w-16 h-16 mx-auto mb-4 text-muted opacity-50" />
          <h3 class="text-lg font-medium text-highlighted mb-2">No Route Data</h3>
          <p class="text-muted text-sm max-w-md mx-auto">
            No location records found for this vehicle in the selected date range.
            Try selecting a different date range.
          </p>
        </div>

        <!-- Route Data Display -->
        <template v-else-if="routeData && routePoints.length > 0">
          <!-- Statistics Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-primary/10">
                  <UIcon name="i-lucide-route" class="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.totalDistanceKm || 0 }}</p>
                  <p class="text-xs text-muted">km traveled</p>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-blue-500/10">
                  <UIcon name="i-lucide-map-pin" class="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.totalPoints || 0 }}</p>
                  <p class="text-xs text-muted">GPS points</p>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-green-500/10">
                  <UIcon name="i-lucide-users" class="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.totalSessions || 0 }}</p>
                  <p class="text-xs text-muted">sessions</p>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-amber-500/10">
                  <UIcon name="i-lucide-circle-stop" class="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.totalStops || 0 }}</p>
                  <p class="text-xs text-muted">stops</p>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-red-500/10">
                  <UIcon name="i-lucide-gauge" class="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.maxSpeedKmh || 0 }}</p>
                  <p class="text-xs text-muted">max km/h</p>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-3' }">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-violet-500/10">
                  <UIcon name="i-lucide-activity" class="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <p class="text-lg font-bold text-highlighted">{{ statistics?.avgSpeedKmh || 0 }}</p>
                  <p class="text-xs text-muted">avg km/h</p>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Main Content Grid -->
          <div class="grid lg:grid-cols-3 gap-4">
            <!-- Map and Playback -->
            <div class="lg:col-span-2 space-y-4">
              <!-- Map -->
              <UCard :ui="{ body: 'p-0' }">
                <div class="relative h-96 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 rounded-lg overflow-hidden">
                  <!-- Map grid overlay -->
                  <div class="absolute inset-0 opacity-10 pointer-events-none">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="route-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#route-grid)" class="text-gray-500" />
                    </svg>
                  </div>

                  <!-- Route path -->
                  <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="rgba(59, 130, 246, 0.6)"
                      stroke-width="0.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      :points="routePoints.map((p: RoutePoint) => {
                        const pos = getMarkerPosition(p.latitude, p.longitude)
                        return `${parseFloat(pos.left)},${parseFloat(pos.top)}`
                      }).join(' ')"
                    />
                  </svg>

                  <!-- Stop markers -->
                  <div
                    v-for="(stop, index) in stops"
                    :key="`stop-${index}`"
                    class="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                    :style="getMarkerPosition(stop.latitude, stop.longitude)"
                  >
                    <div class="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-500/30" />
                  </div>

                  <!-- Current position marker (during playback) -->
                  <div
                    v-if="currentPoint"
                    class="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-100"
                    :style="getMarkerPosition(currentPoint.latitude, currentPoint.longitude)"
                  >
                    <div class="relative">
                      <span class="absolute w-6 h-6 rounded-full bg-primary animate-ping opacity-75" />
                      <div class="relative w-4 h-4 rounded-full bg-primary ring-4 ring-primary/30">
                        <div class="absolute inset-1 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>

                  <!-- Start marker -->
                  <div
                    v-if="routePoints[0]"
                    class="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                    :style="getMarkerPosition(routePoints[0].latitude, routePoints[0].longitude)"
                  >
                    <div class="w-4 h-4 rounded-full bg-green-500 ring-2 ring-green-500/30 flex items-center justify-center">
                      <span class="text-[8px] font-bold text-white">S</span>
                    </div>
                  </div>

                  <!-- End marker -->
                  <div
                    v-if="routePoints[routePoints.length - 1] && routePoints.length > 1"
                    class="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                    :style="getMarkerPosition(routePoints[routePoints.length - 1]!.latitude, routePoints[routePoints.length - 1]!.longitude)"
                  >
                    <div class="w-4 h-4 rounded-full bg-red-500 ring-2 ring-red-500/30 flex items-center justify-center">
                      <span class="text-[8px] font-bold text-white">E</span>
                    </div>
                  </div>

                  <!-- Legend -->
                  <div class="absolute bottom-3 left-3 bg-elevated/95 border border-default rounded-lg px-2 py-1.5 text-xs space-y-1 z-10">
                    <div class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span class="text-muted">Start</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span class="text-muted">End</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span class="text-muted">Stop</span>
                    </div>
                  </div>
                </div>
              </UCard>

              <!-- Playback Controls -->
              <UCard>
                <div class="space-y-4">
                  <!-- Progress bar -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs text-muted">
                      <span v-if="currentPoint">{{ dtf.format(new Date(currentPoint.recordedAt)) }}</span>
                      <span v-else>-</span>
                      <span>{{ currentPointIndex + 1 }} / {{ routePoints.length }} points</span>
                    </div>
                    <input
                      type="range"
                      :value="playbackProgress"
                      min="0"
                      max="100"
                      step="0.1"
                      class="w-full h-2 bg-muted/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                      @input="(e) => setPlaybackPosition(Number((e.target as HTMLInputElement).value))"
                    />
                  </div>

                  <!-- Controls -->
                  <div class="flex items-center justify-center gap-4">
                    <UButton
                      icon="i-lucide-rotate-ccw"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="routePoints.length === 0"
                      @click="resetPlayback"
                    />
                    <UButton
                      :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
                      color="primary"
                      size="lg"
                      :disabled="routePoints.length === 0"
                      @click="togglePlayback"
                    />
                    <USelect
                      v-model="playbackSpeed"
                      :items="speedOptions"
                      size="sm"
                      class="w-20"
                    />
                  </div>

                  <!-- Current point info -->
                  <div v-if="currentPoint" class="grid grid-cols-4 gap-4 text-center pt-2 border-t border-default">
                    <div>
                      <p class="text-xs text-muted">Speed</p>
                      <p class="font-medium text-highlighted">
                        {{ currentPoint.speed?.toFixed(1) || '-' }} km/h
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-muted">Heading</p>
                      <p class="font-medium text-highlighted">
                        {{ currentPoint.heading?.toFixed(0) || '-' }}&deg;
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-muted">Altitude</p>
                      <p class="font-medium text-highlighted">
                        {{ currentPoint.altitude?.toFixed(0) || '-' }} m
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-muted">Accuracy</p>
                      <p class="font-medium text-highlighted">
                        {{ currentPoint.accuracy?.toFixed(0) || '-' }} m
                      </p>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>

            <!-- Timeline Sidebar -->
            <div class="lg:col-span-1">
              <UCard :ui="{ body: 'p-0' }">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-clock" class="w-4 h-4 text-muted" />
                    <span class="font-medium">Session Timeline</span>
                  </div>
                </template>

                <div class="max-h-[600px] overflow-y-auto">
                  <div v-if="sessions.length === 0" class="p-4 text-center text-muted text-sm">
                    No sessions found in this date range.
                  </div>

                  <ul v-else class="divide-y divide-default">
                    <li
                      v-for="session in sessions"
                      :key="session.id"
                      class="p-3 hover:bg-elevated/50 cursor-pointer transition-colors"
                      @click="jumpToSession(session)"
                    >
                      <div class="flex items-start gap-3">
                        <!-- Status indicator -->
                        <div class="flex-shrink-0 mt-1">
                          <span
                            class="block w-2.5 h-2.5 rounded-full"
                            :class="{
                              'bg-green-500': session.status === 'completed',
                              'bg-blue-500': session.status === 'active',
                              'bg-gray-400': session.status === 'cancelled',
                            }"
                          />
                        </div>

                        <div class="flex-1 min-w-0">
                          <!-- Time -->
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-highlighted">
                              {{ dtf.format(new Date(session.startTime)) }}
                            </span>
                            <UBadge
                              :color="session.status === 'completed' ? 'success' : session.status === 'active' ? 'info' : 'neutral'"
                              variant="subtle"
                              size="xs"
                              class="capitalize"
                            >
                              {{ session.status }}
                            </UBadge>
                          </div>

                          <!-- Operator -->
                          <p v-if="session.operator" class="text-xs text-muted mt-0.5">
                            <UIcon name="i-lucide-user" class="w-3 h-3 inline-block mr-0.5" />
                            {{ session.operator.name }}
                          </p>

                          <!-- Duration and distance -->
                          <div class="flex items-center gap-3 mt-1 text-xs text-muted">
                            <span v-if="session.tripDurationMinutes" class="flex items-center gap-0.5">
                              <UIcon name="i-lucide-clock" class="w-3 h-3" />
                              {{ formatDuration(session.tripDurationMinutes) }}
                            </span>
                            <span v-if="session.tripDistance" class="flex items-center gap-0.5">
                              <UIcon name="i-lucide-route" class="w-3 h-3" />
                              {{ Number(session.tripDistance).toFixed(1) }} km
                            </span>
                          </div>

                          <!-- Locations -->
                          <div v-if="session.startLocationName || session.endLocationName" class="mt-1.5 text-xs">
                            <div v-if="session.startLocationName" class="flex items-center gap-1 text-muted">
                              <UIcon name="i-lucide-map-pin" class="w-3 h-3 text-green-500" />
                              <span class="truncate">{{ session.startLocationName }}</span>
                            </div>
                            <div v-if="session.endLocationName && session.endLocationName !== session.startLocationName" class="flex items-center gap-1 text-muted mt-0.5">
                              <UIcon name="i-lucide-map-pin" class="w-3 h-3 text-red-500" />
                              <span class="truncate">{{ session.endLocationName }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Stops Section -->
                <template v-if="stops.length > 0">
                  <div class="border-t border-default px-3 py-2 bg-elevated/50">
                    <div class="flex items-center gap-2 text-sm font-medium text-muted">
                      <UIcon name="i-lucide-circle-stop" class="w-4 h-4" />
                      <span>Stops ({{ stops.length }})</span>
                    </div>
                  </div>

                  <ul class="divide-y divide-default">
                    <li
                      v-for="(stop, index) in stops.slice(0, 10)"
                      :key="`stop-${index}`"
                      class="px-3 py-2 text-xs"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-muted">
                          {{ dtf.format(new Date(stop.startTime)) }}
                        </span>
                        <UBadge color="warning" variant="subtle" size="xs">
                          {{ formatDuration(stop.durationMinutes) }}
                        </UBadge>
                      </div>
                      <p class="text-muted font-mono text-[10px] mt-0.5">
                        {{ stop.latitude.toFixed(5) }}, {{ stop.longitude.toFixed(5) }}
                      </p>
                    </li>
                  </ul>

                  <div v-if="stops.length > 10" class="px-3 py-2 text-center text-xs text-muted border-t border-default">
                    And {{ stops.length - 10 }} more stops...
                  </div>
                </template>
              </UCard>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
