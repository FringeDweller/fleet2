<script setup lang="ts">
/**
 * Live Data Dashboard Component (US-10.5)
 *
 * Displays a grid of vehicle gauges with start/stop monitoring controls.
 * Supports toggle between gauge and numeric display modes.
 */

import { type LiveVehicleMetric, useLiveVehicleData } from '~/composables/useLiveVehicleData'
import { getBluetoothObdService } from '~/services/bluetoothObd'

interface Props {
  /** Asset ID for context */
  assetId: string
}

defineProps<Props>()

// Get live data composable
const {
  connectionState,
  isConnected,
  isPolling,
  pollInterval,
  pollCount,
  timeSinceLastUpdate,
  lastError,
  metrics,
  metricsArray,
  hasData,
  startPolling,
  stopPolling,
  setPollInterval,
  resetMetrics,
  getFormattedValue,
  getMetricColor,
  getMetricPercentage,
  AVAILABLE_POLL_INTERVALS,
} = useLiveVehicleData()

// Get OBD service for connection status
const obdService = getBluetoothObdService()

// View mode toggle
const viewMode = ref<'gauges' | 'numeric'>('gauges')

// Poll interval selection
type IntervalOption = { label: string; value: 500 | 1000 | 2000 | 5000 }
const intervalOptions: IntervalOption[] = AVAILABLE_POLL_INTERVALS.map((ms) => ({
  label: ms < 1000 ? `${ms}ms` : `${ms / 1000}s`,
  value: ms,
}))

const selectedIntervalOption = ref<IntervalOption>(
  intervalOptions.find((opt) => opt.value === pollInterval.value) || intervalOptions[1]!,
)

// Watch for interval changes
watch(selectedIntervalOption, (newOption) => {
  if (newOption) {
    setPollInterval(newOption.value)
  }
})

// Connection status message
const connectionMessage = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return 'OBD device connected'
    case 'connecting':
      return 'Connecting to OBD device...'
    case 'reconnecting':
      return 'Reconnecting to OBD device...'
    default:
      return 'No OBD connection'
  }
})

// Connection status color
const connectionColor = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return 'success'
    case 'connecting':
    case 'reconnecting':
      return 'warning'
    default:
      return 'neutral'
  }
})

// Handle start/stop toggle
function togglePolling() {
  if (isPolling.value) {
    stopPolling()
  } else {
    startPolling(selectedIntervalOption.value.value)
  }
}

// Get icon for metric
function getMetricIcon(key: string): string {
  const icons: Record<string, string> = {
    rpm: 'i-lucide-gauge',
    speed: 'i-lucide-gauge-circle',
    coolantTemp: 'i-lucide-thermometer',
    fuelLevel: 'i-lucide-fuel',
    throttle: 'i-lucide-joystick',
    engineLoad: 'i-lucide-activity',
  }
  return icons[key] || 'i-lucide-circle'
}

// Format metric for numeric view
function formatMetricNumeric(metric: LiveVehicleMetric): string {
  if (metric.value === null) return `-- ${metric.pid.unit}`
  const formatted = getFormattedValue(metric)
  return `${formatted} ${metric.pid.unit}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Connection Status Banner -->
    <div
      v-if="!isConnected"
      class="rounded-lg border p-4 flex items-center gap-3"
      :class="{
        'bg-warning/10 border-warning': connectionState === 'connecting' || connectionState === 'reconnecting',
        'bg-muted border-muted': connectionState === 'disconnected'
      }"
    >
      <UIcon
        :name="connectionState === 'disconnected' ? 'i-lucide-bluetooth-off' : 'i-lucide-loader-2'"
        class="size-5 shrink-0"
        :class="{
          'text-warning animate-spin': connectionState === 'connecting' || connectionState === 'reconnecting',
          'text-muted-foreground': connectionState === 'disconnected'
        }"
      />
      <div class="flex-1">
        <p class="font-medium text-sm">{{ connectionMessage }}</p>
        <p v-if="connectionState === 'disconnected'" class="text-xs text-muted-foreground mt-1">
          Pair an OBD-II device in the device settings to view live vehicle data.
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div
      v-if="isConnected"
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3">
        <!-- Start/Stop Button -->
        <UButton
          :color="isPolling ? 'error' : 'primary'"
          :variant="isPolling ? 'soft' : 'solid'"
          :icon="isPolling ? 'i-lucide-square' : 'i-lucide-play'"
          @click="togglePolling"
        >
          {{ isPolling ? 'Stop Monitoring' : 'Start Monitoring' }}
        </UButton>

        <!-- Poll Interval -->
        <USelectMenu
          v-model="selectedIntervalOption"
          :items="intervalOptions"
          option-attribute="label"
          :disabled="!isPolling"
          class="w-24"
        >
          <template #leading>
            <UIcon name="i-lucide-timer" class="size-4 text-muted-foreground" />
          </template>
        </USelectMenu>
      </div>

      <div class="flex items-center gap-4">
        <!-- View Mode Toggle -->
        <UButtonGroup>
          <UButton
            :color="viewMode === 'gauges' ? 'primary' : 'neutral'"
            :variant="viewMode === 'gauges' ? 'solid' : 'ghost'"
            icon="i-lucide-gauge"
            size="sm"
            @click="viewMode = 'gauges'"
          />
          <UButton
            :color="viewMode === 'numeric' ? 'primary' : 'neutral'"
            :variant="viewMode === 'numeric' ? 'solid' : 'ghost'"
            icon="i-lucide-list"
            size="sm"
            @click="viewMode = 'numeric'"
          />
        </UButtonGroup>

        <!-- Status Indicator -->
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            class="size-2 rounded-full"
            :class="{
              'bg-success animate-pulse': isPolling,
              'bg-muted': !isPolling
            }"
          />
          <span v-if="isPolling">
            {{ pollCount }} updates
            <span v-if="timeSinceLastUpdate">({{ timeSinceLastUpdate }})</span>
          </span>
          <span v-else>Stopped</span>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <UAlert
      v-if="lastError"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      :title="lastError"
      :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link', padded: false }"
      @close="lastError = null"
    />

    <!-- Gauges View -->
    <div
      v-if="isConnected && viewMode === 'gauges'"
      class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6"
    >
      <div
        v-for="metric in metricsArray"
        :key="metric.key"
        class="flex justify-center"
      >
        <ObdVehicleGauge
          :value="metric.value"
          :min="metric.pid.min"
          :max="metric.pid.max"
          :unit="metric.pid.unit"
          :label="metric.pid.name"
          :color="getMetricColor(metric as unknown as LiveVehicleMetric)"
          :format-value="metric.pid.format"
          :is-loading="metric.isLoading"
          size="md"
        />
      </div>
    </div>

    <!-- Numeric View -->
    <div
      v-if="isConnected && viewMode === 'numeric'"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="metric in metricsArray"
        :key="metric.key"
        class="rounded-lg border p-4 flex items-center gap-4"
        :class="{
          'bg-success/5 border-success': getMetricColor(metric as unknown as LiveVehicleMetric) === 'success',
          'bg-warning/5 border-warning': getMetricColor(metric as unknown as LiveVehicleMetric) === 'warning',
          'bg-error/5 border-error': getMetricColor(metric as unknown as LiveVehicleMetric) === 'error',
          'bg-primary/5 border-primary': getMetricColor(metric as unknown as LiveVehicleMetric) === 'primary',
        }"
      >
        <div
          class="size-12 rounded-full flex items-center justify-center"
          :class="{
            'bg-success/10 text-success': getMetricColor(metric as unknown as LiveVehicleMetric) === 'success',
            'bg-warning/10 text-warning': getMetricColor(metric as unknown as LiveVehicleMetric) === 'warning',
            'bg-error/10 text-error': getMetricColor(metric as unknown as LiveVehicleMetric) === 'error',
            'bg-primary/10 text-primary': getMetricColor(metric as unknown as LiveVehicleMetric) === 'primary',
            'bg-muted text-muted-foreground': getMetricColor(metric as unknown as LiveVehicleMetric) === 'neutral',
          }"
        >
          <UIcon :name="getMetricIcon(metric.key)" class="size-6" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted-foreground truncate">{{ metric.pid.name }}</p>
          <p class="text-2xl font-semibold tabular-nums">
            {{ formatMetricNumeric(metric as unknown as LiveVehicleMetric) }}
          </p>
        </div>
        <!-- Mini progress bar -->
        <div class="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="{
              'bg-success': getMetricColor(metric as unknown as LiveVehicleMetric) === 'success',
              'bg-warning': getMetricColor(metric as unknown as LiveVehicleMetric) === 'warning',
              'bg-error': getMetricColor(metric as unknown as LiveVehicleMetric) === 'error',
              'bg-primary': getMetricColor(metric as unknown as LiveVehicleMetric) === 'primary',
              'bg-muted-foreground': getMetricColor(metric as unknown as LiveVehicleMetric) === 'neutral',
            }"
            :style="{ width: `${getMetricPercentage(metric as unknown as LiveVehicleMetric)}%` }"
          />
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div
      v-if="isConnected && !hasData && !isPolling"
      class="text-center py-12"
    >
      <UIcon name="i-lucide-gauge" class="size-12 mx-auto mb-3 text-muted-foreground" />
      <p class="text-muted-foreground">
        Click "Start Monitoring" to begin reading live vehicle data
      </p>
    </div>

    <!-- Connected Device Info -->
    <div v-if="isConnected" class="pt-4 border-t">
      <div class="flex items-center justify-between text-sm text-muted-foreground">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-bluetooth" class="size-4 text-success" />
          <span>{{ obdService.state.connectedDevice?.name || 'Connected Device' }}</span>
        </div>
        <UBadge :color="connectionColor" variant="subtle" size="xs">
          {{ connectionState }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
