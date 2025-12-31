/**
 * Live Vehicle Data Composable (US-10.5)
 *
 * Provides reactive state for live OBD-II vehicle data with
 * configurable polling and connection state awareness.
 */

import { createSharedComposable } from '@vueuse/core'
import { getBluetoothObdService, type ObdConnectionState } from '~/services/bluetoothObd'
import { getObdCommandsService, type LiveDataValues } from '~/services/obdCommands'
import {
  DEFAULT_POLL_INTERVAL,
  getGaugeColor,
  LIVE_DATA_PIDS,
  MAX_POLL_INTERVAL,
  MIN_POLL_INTERVAL,
  type ObdPid,
  PID_COOLANT_TEMP,
  PID_FUEL_LEVEL,
  PID_RPM,
  PID_SPEED,
  PID_THROTTLE,
} from '~/utils/obdPids'

export interface LiveVehicleMetric {
  /** Current value (null if no data) */
  value: number | null
  /** PID definition */
  pid: ObdPid
  /** Whether this metric is currently being read */
  isLoading: boolean
  /** Last read error (null if successful) */
  error: string | null
  /** Timestamp of last successful read */
  lastUpdated: Date | null
}

export interface LiveVehicleDataState {
  /** Engine RPM */
  rpm: LiveVehicleMetric
  /** Vehicle Speed */
  speed: LiveVehicleMetric
  /** Coolant Temperature */
  coolantTemp: LiveVehicleMetric
  /** Fuel Level */
  fuelLevel: LiveVehicleMetric
  /** Throttle Position */
  throttle: LiveVehicleMetric
}

const _useLiveVehicleData = () => {
  // Get service instances
  const obdService = getBluetoothObdService()
  const commandsService = getObdCommandsService()

  // Connection state
  const connectionState = ref<ObdConnectionState>('disconnected')
  const isConnected = computed(() => connectionState.value === 'connected')

  // Polling state
  const isPolling = ref(false)
  const pollInterval = ref(DEFAULT_POLL_INTERVAL)
  const pollIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
  const lastPollTime = ref<Date | null>(null)
  const pollCount = ref(0)

  // Error state
  const lastError = ref<string | null>(null)

  // Create initial metric state
  function createMetricState(pid: ObdPid): LiveVehicleMetric {
    return {
      value: null,
      pid,
      isLoading: false,
      error: null,
      lastUpdated: null,
    }
  }

  // Live data state
  const metrics = reactive<LiveVehicleDataState>({
    rpm: createMetricState(PID_RPM),
    speed: createMetricState(PID_SPEED),
    coolantTemp: createMetricState(PID_COOLANT_TEMP),
    fuelLevel: createMetricState(PID_FUEL_LEVEL),
    throttle: createMetricState(PID_THROTTLE),
  })

  // Subscribe to OBD service state changes
  onMounted(() => {
    const unsubscribe = obdService.onStateChange((state) => {
      connectionState.value = state.connectionState

      // Stop polling if disconnected
      if (state.connectionState === 'disconnected' && isPolling.value) {
        stopPolling()
      }
    })

    // Cleanup on unmount
    onUnmounted(() => {
      unsubscribe()
      stopPolling()
    })
  })

  /**
   * Read all live data metrics once
   */
  async function readAllMetrics(): Promise<void> {
    if (!isConnected.value) {
      lastError.value = 'OBD device not connected'
      return
    }

    // Initialize commands service if needed
    if (!commandsService.isInitialized) {
      const initialized = await commandsService.initialize()
      if (!initialized) {
        lastError.value = commandsService.lastError || 'Failed to initialize OBD commands'
        return
      }
    }

    lastError.value = null
    const now = new Date()

    // Read all PIDs
    const data = await commandsService.readAllLiveData()

    // Update metrics
    if (data.rpm !== null) {
      metrics.rpm.value = data.rpm
      metrics.rpm.lastUpdated = now
      metrics.rpm.error = null
    }

    if (data.speed !== null) {
      metrics.speed.value = data.speed
      metrics.speed.lastUpdated = now
      metrics.speed.error = null
    }

    if (data.coolantTemp !== null) {
      metrics.coolantTemp.value = data.coolantTemp
      metrics.coolantTemp.lastUpdated = now
      metrics.coolantTemp.error = null
    }

    if (data.fuelLevel !== null) {
      metrics.fuelLevel.value = data.fuelLevel
      metrics.fuelLevel.lastUpdated = now
      metrics.fuelLevel.error = null
    }

    if (data.throttle !== null) {
      metrics.throttle.value = data.throttle
      metrics.throttle.lastUpdated = now
      metrics.throttle.error = null
    }

    lastPollTime.value = now
    pollCount.value++
  }

  /**
   * Start continuous polling
   */
  function startPolling(interval?: number): void {
    if (isPolling.value) {
      stopPolling()
    }

    if (!isConnected.value) {
      lastError.value = 'Cannot start polling: OBD device not connected'
      return
    }

    // Validate interval
    const validInterval = Math.max(
      MIN_POLL_INTERVAL,
      Math.min(MAX_POLL_INTERVAL, interval ?? pollInterval.value),
    )
    pollInterval.value = validInterval

    isPolling.value = true
    pollCount.value = 0
    lastError.value = null

    // Initial read
    readAllMetrics()

    // Set up interval
    pollIntervalId.value = setInterval(() => {
      readAllMetrics()
    }, validInterval)
  }

  /**
   * Stop continuous polling
   */
  function stopPolling(): void {
    if (pollIntervalId.value) {
      clearInterval(pollIntervalId.value)
      pollIntervalId.value = null
    }
    isPolling.value = false
  }

  /**
   * Update polling interval (will restart polling if active)
   */
  function setPollInterval(interval: number): void {
    const wasPolling = isPolling.value
    if (wasPolling) {
      stopPolling()
    }

    pollInterval.value = Math.max(MIN_POLL_INTERVAL, Math.min(MAX_POLL_INTERVAL, interval))

    if (wasPolling) {
      startPolling()
    }
  }

  /**
   * Reset all metrics to null
   */
  function resetMetrics(): void {
    for (const key of Object.keys(metrics) as (keyof LiveVehicleDataState)[]) {
      metrics[key].value = null
      metrics[key].lastUpdated = null
      metrics[key].error = null
      metrics[key].isLoading = false
    }
    pollCount.value = 0
    lastPollTime.value = null
  }

  /**
   * Get formatted value for display
   */
  function getFormattedValue(metric: LiveVehicleMetric): string {
    if (metric.value === null) return '--'
    const format = metric.pid.format
    return format ? format(metric.value) : metric.value.toFixed(1)
  }

  /**
   * Get color for a metric's gauge
   */
  function getMetricColor(
    metric: LiveVehicleMetric,
  ): 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    if (metric.value === null) return 'neutral'
    return getGaugeColor(metric.value, metric.pid.min, metric.pid.max, metric.pid.name)
  }

  /**
   * Get percentage of max for gauge visualization
   */
  function getMetricPercentage(metric: LiveVehicleMetric): number {
    if (metric.value === null) return 0
    const { min, max } = metric.pid
    return Math.max(0, Math.min(100, ((metric.value - min) / (max - min)) * 100))
  }

  /**
   * Get all metrics as an array for iteration
   */
  const metricsArray = computed(() => [
    { key: 'rpm', ...metrics.rpm },
    { key: 'speed', ...metrics.speed },
    { key: 'coolantTemp', ...metrics.coolantTemp },
    { key: 'fuelLevel', ...metrics.fuelLevel },
    { key: 'throttle', ...metrics.throttle },
  ])

  /**
   * Check if any data has been received
   */
  const hasData = computed(() => {
    return Object.values(metrics).some((m) => m.value !== null)
  })

  /**
   * Get time since last update (human readable)
   */
  const timeSinceLastUpdate = computed(() => {
    if (!lastPollTime.value) return null
    const diff = Date.now() - lastPollTime.value.getTime()
    if (diff < 1000) return 'just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return 'over an hour ago'
  })

  return {
    // Connection state
    connectionState: readonly(connectionState),
    isConnected,

    // Polling state
    isPolling: readonly(isPolling),
    pollInterval: readonly(pollInterval),
    pollCount: readonly(pollCount),
    lastPollTime: readonly(lastPollTime),
    timeSinceLastUpdate,

    // Error state
    lastError: readonly(lastError),

    // Metrics
    metrics,
    metricsArray,
    hasData,

    // Methods
    readAllMetrics,
    startPolling,
    stopPolling,
    setPollInterval,
    resetMetrics,

    // Helpers
    getFormattedValue,
    getMetricColor,
    getMetricPercentage,

    // Constants for UI
    MIN_POLL_INTERVAL,
    MAX_POLL_INTERVAL,
    DEFAULT_POLL_INTERVAL,
    AVAILABLE_POLL_INTERVALS: [500, 1000, 2000, 5000] as const,
  }
}

export const useLiveVehicleData = createSharedComposable(_useLiveVehicleData)
