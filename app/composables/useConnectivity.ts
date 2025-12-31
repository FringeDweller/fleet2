/**
 * Connectivity Composable
 * Provides enhanced network connectivity detection with real server reachability checks,
 * periodic health monitoring, connection quality metrics, and automatic retry with backoff.
 *
 * This extends the capabilities of useNetworkStatus by verifying actual server connectivity
 * rather than just network interface status.
 */

/** Health check response from /api/health */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  database: {
    connected: boolean
    latency_ms: number
  }
  memory: {
    used_mb: number
    total_mb: number
    percentage: number
  }
  uptime_seconds: number
  timestamp: string
}

/** Connection quality metrics */
export interface ConnectionQuality {
  /** Last measured latency to the server in milliseconds */
  latency: number | null
  /** Calculated jitter (latency variance) in milliseconds */
  jitter: number | null
  /** Quality rating based on latency */
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
}

/** Connectivity state exposed by the composable */
export interface ConnectivityState {
  /** Whether the server is actually reachable (not just network interface online) */
  isConnected: Readonly<Ref<boolean>>
  /** When the last successful health check completed */
  lastCheckedAt: Readonly<Ref<Date | null>>
  /** Last measured server latency in milliseconds */
  latency: Readonly<Ref<number | null>>
  /** Calculated jitter (latency variance) in milliseconds */
  jitter: Readonly<Ref<number | null>>
  /** Connection quality rating */
  quality: Readonly<Ref<ConnectionQuality['rating']>>
  /** Whether the monitoring is currently active */
  isMonitoring: Readonly<Ref<boolean>>
  /** Number of consecutive failures */
  consecutiveFailures: Readonly<Ref<number>>
  /** Whether a health check is currently in progress */
  isChecking: Readonly<Ref<boolean>>
  /** Last error message if check failed */
  lastError: Readonly<Ref<string | null>>
}

/** Callback type for connectivity changes */
export type ConnectivityChangeCallback = (state: {
  isConnected: boolean
  wasConnected: boolean
  latency: number | null
  quality: ConnectionQuality['rating']
}) => void

/** Options for the connectivity composable */
export interface UseConnectivityOptions {
  /** Health check endpoint (default: /api/health) */
  healthEndpoint?: string
  /** Default polling interval in milliseconds (default: 30000 = 30s) */
  defaultInterval?: number
  /** Request timeout in milliseconds (default: 10000 = 10s) */
  timeout?: number
  /** Maximum retry delay for backoff in milliseconds (default: 60000 = 60s) */
  maxRetryDelay?: number
  /** Initial retry delay in milliseconds (default: 1000 = 1s) */
  initialRetryDelay?: number
  /** Whether to start monitoring automatically (default: false) */
  autoStart?: boolean
  /** Interval for monitoring when connected (default: 30000 = 30s) */
  connectedInterval?: number
  /** Interval for reconnection attempts when disconnected (default: 5000 = 5s) */
  disconnectedInterval?: number
}

// Default configuration
const DEFAULT_OPTIONS: Required<UseConnectivityOptions> = {
  healthEndpoint: '/api/health',
  defaultInterval: 30000,
  timeout: 10000,
  maxRetryDelay: 60000,
  initialRetryDelay: 1000,
  autoStart: false,
  connectedInterval: 30000,
  disconnectedInterval: 5000,
}

// Quality thresholds in milliseconds
const QUALITY_THRESHOLDS = {
  excellent: 100, // < 100ms
  good: 300, // < 300ms
  fair: 600, // < 600ms
  poor: 1000, // < 1000ms, above is "poor" as well
}

// Number of latency samples to keep for jitter calculation
const LATENCY_SAMPLE_SIZE = 5

/**
 * Calculate connection quality rating based on latency
 */
function calculateQuality(latency: number | null): ConnectionQuality['rating'] {
  if (latency === null) return 'unknown'
  if (latency < QUALITY_THRESHOLDS.excellent) return 'excellent'
  if (latency < QUALITY_THRESHOLDS.good) return 'good'
  if (latency < QUALITY_THRESHOLDS.fair) return 'fair'
  return 'poor'
}

/**
 * Calculate jitter from latency samples (standard deviation)
 */
function calculateJitter(samples: number[]): number | null {
  if (samples.length < 2) return null
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const squaredDiffs = samples.map((value) => (value - mean) ** 2)
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length
  return Math.round(Math.sqrt(avgSquaredDiff) * 100) / 100
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, initialDelay: number, maxDelay: number): number {
  const delay = initialDelay * 2 ** attempt
  // Add some jitter (10-20% random variation)
  const jitter = delay * (0.1 + Math.random() * 0.1)
  return Math.min(delay + jitter, maxDelay)
}

export function useConnectivity(options: UseConnectivityOptions = {}): ConnectivityState & {
  /** Manually trigger a connectivity check */
  checkConnectivity: () => Promise<boolean>
  /** Start periodic monitoring */
  startMonitoring: (intervalMs?: number) => void
  /** Stop periodic monitoring */
  stopMonitoring: () => void
  /** Register a callback for connectivity changes */
  onConnectivityChange: (callback: ConnectivityChangeCallback) => () => void
  /** Get current connection quality metrics */
  getQualityMetrics: () => ConnectionQuality
} {
  const config = { ...DEFAULT_OPTIONS, ...options }

  // Core state
  const isConnected = ref(true) // Assume connected initially
  const lastCheckedAt = ref<Date | null>(null)
  const latency = ref<number | null>(null)
  const jitter = ref<number | null>(null)
  const quality = ref<ConnectionQuality['rating']>('unknown')
  const isMonitoring = ref(false)
  const consecutiveFailures = ref(0)
  const isChecking = ref(false)
  const lastError = ref<string | null>(null)

  // Internal state
  const wasConnected = ref(true)
  const latencySamples: number[] = []
  let monitoringInterval: ReturnType<typeof setInterval> | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  // Callback registry
  const changeCallbacks = new Set<ConnectivityChangeCallback>()

  /**
   * Notify all registered callbacks of connectivity changes
   */
  const notifyChange = () => {
    const state = {
      isConnected: isConnected.value,
      wasConnected: wasConnected.value,
      latency: latency.value,
      quality: quality.value,
    }

    for (const callback of changeCallbacks) {
      try {
        callback(state)
      } catch (err) {
        console.error('[useConnectivity] Error in change callback:', err)
      }
    }

    // Update wasConnected for next comparison
    wasConnected.value = isConnected.value
  }

  /**
   * Perform a health check against the server
   */
  const checkConnectivity = async (): Promise<boolean> => {
    if (!import.meta.client) return true
    if (isChecking.value) return isConnected.value

    isChecking.value = true
    lastError.value = null

    const startTime = performance.now()

    try {
      // Use AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      const response = await fetch(config.healthEndpoint, {
        method: 'GET',
        signal: controller.signal,
        // Prevent caching
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })

      clearTimeout(timeoutId)

      const endTime = performance.now()
      const requestLatency = Math.round((endTime - startTime) * 100) / 100

      if (response.ok) {
        const data: HealthCheckResponse = await response.json()

        // Server responded, check if it reports healthy
        const serverHealthy = data.status === 'healthy'

        if (serverHealthy) {
          // Update latency samples for jitter calculation
          latencySamples.push(requestLatency)
          if (latencySamples.length > LATENCY_SAMPLE_SIZE) {
            latencySamples.shift()
          }

          // Update state
          latency.value = requestLatency
          jitter.value = calculateJitter(latencySamples)
          quality.value = calculateQuality(requestLatency)
          lastCheckedAt.value = new Date()
          consecutiveFailures.value = 0

          // Handle connection state change
          const previouslyConnected = isConnected.value
          isConnected.value = true

          if (!previouslyConnected) {
            // Just reconnected
            notifyChange()
          }

          isChecking.value = false
          return true
        } else {
          // Server reports unhealthy (e.g., database down)
          throw new Error(`Server unhealthy: ${data.status}`)
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        lastError.value = `Request timeout after ${config.timeout}ms`
      } else {
        lastError.value = error.message
      }

      consecutiveFailures.value++

      // Handle connection state change
      const previouslyConnected = isConnected.value
      isConnected.value = false
      quality.value = 'unknown'
      latency.value = null

      if (previouslyConnected) {
        // Just disconnected
        notifyChange()
      }

      // If monitoring, schedule reconnection attempt with backoff
      if (isMonitoring.value && reconnectTimeout === null) {
        scheduleReconnect()
      }

      isChecking.value = false
      return false
    } finally {
      isChecking.value = false
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  const scheduleReconnect = () => {
    if (reconnectTimeout !== null) {
      clearTimeout(reconnectTimeout)
    }

    // Use disconnectedInterval as base, but apply backoff for repeated failures
    const delay = calculateBackoff(
      Math.min(consecutiveFailures.value, 6), // Cap backoff attempts
      config.disconnectedInterval,
      config.maxRetryDelay,
    )

    reconnectTimeout = setTimeout(async () => {
      reconnectTimeout = null

      if (isMonitoring.value && !isConnected.value) {
        const success = await checkConnectivity()

        // If still disconnected, schedule another attempt
        if (!success && isMonitoring.value) {
          scheduleReconnect()
        }
      }
    }, delay)
  }

  /**
   * Start periodic connectivity monitoring
   */
  const startMonitoring = (intervalMs?: number) => {
    if (!import.meta.client) return
    if (isMonitoring.value) {
      stopMonitoring()
    }

    const interval = intervalMs ?? config.connectedInterval
    isMonitoring.value = true

    // Do an immediate check
    checkConnectivity()

    // Set up periodic checks
    monitoringInterval = setInterval(() => {
      // Only do periodic checks when connected
      // When disconnected, reconnection attempts handle it
      if (isConnected.value) {
        checkConnectivity()
      }
    }, interval)
  }

  /**
   * Stop periodic monitoring
   */
  const stopMonitoring = () => {
    isMonitoring.value = false

    if (monitoringInterval !== null) {
      clearInterval(monitoringInterval)
      monitoringInterval = null
    }

    if (reconnectTimeout !== null) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  /**
   * Register a callback for connectivity changes
   */
  const onConnectivityChange = (callback: ConnectivityChangeCallback): (() => void) => {
    changeCallbacks.add(callback)
    return () => {
      changeCallbacks.delete(callback)
    }
  }

  /**
   * Get current connection quality metrics
   */
  const getQualityMetrics = (): ConnectionQuality => ({
    latency: latency.value,
    jitter: jitter.value,
    rating: quality.value,
  })

  // Handle browser online/offline events for immediate detection
  if (import.meta.client) {
    // When browser goes offline, immediately mark as disconnected
    const handleOffline = () => {
      if (isConnected.value) {
        isConnected.value = false
        quality.value = 'unknown'
        latency.value = null
        notifyChange()
      }

      // If monitoring, start trying to reconnect
      if (isMonitoring.value) {
        scheduleReconnect()
      }
    }

    // When browser comes online, verify with a health check
    const handleOnline = () => {
      // Browser says we're online, verify with a real check
      checkConnectivity()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Auto-start monitoring if configured
    if (config.autoStart) {
      startMonitoring()
    }

    // Cleanup on unmount
    onUnmounted(() => {
      stopMonitoring()
      changeCallbacks.clear()
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    })
  }

  return {
    // State
    isConnected: readonly(isConnected),
    lastCheckedAt: readonly(lastCheckedAt),
    latency: readonly(latency),
    jitter: readonly(jitter),
    quality: readonly(quality),
    isMonitoring: readonly(isMonitoring),
    consecutiveFailures: readonly(consecutiveFailures),
    isChecking: readonly(isChecking),
    lastError: readonly(lastError),

    // Methods
    checkConnectivity,
    startMonitoring,
    stopMonitoring,
    onConnectivityChange,
    getQualityMetrics,
  }
}

/**
 * Composable that integrates connectivity monitoring with the offline queue.
 * Automatically triggers sync when connection is restored.
 */
export function useConnectivityWithSync(
  options: UseConnectivityOptions & {
    /** Callback to trigger when sync should happen */
    onSync?: () => Promise<void>
    /** Delay before triggering sync after reconnection (default: 1000ms) */
    syncDelay?: number
  } = {},
) {
  const { onSync, syncDelay = 1000, ...connectivityOptions } = options
  const connectivity = useConnectivity(connectivityOptions)
  const toast = useToast()

  // Track if we have pending items to sync
  const hasPendingSync = ref(false)
  let syncTimeout: ReturnType<typeof setTimeout> | null = null

  if (import.meta.client) {
    // Listen for connectivity changes
    const unsubscribe = connectivity.onConnectivityChange(
      async ({ isConnected, wasConnected, quality }) => {
        if (isConnected && !wasConnected) {
          // Just reconnected
          toast.add({
            title: 'Back online',
            description: `Connection restored. Quality: ${quality}`,
            color: 'success',
            icon: 'i-lucide-wifi',
          })

          // Trigger sync after a short delay to let things stabilize
          if (onSync && hasPendingSync.value) {
            if (syncTimeout) clearTimeout(syncTimeout)
            syncTimeout = setTimeout(async () => {
              try {
                await onSync()
                hasPendingSync.value = false
              } catch (err) {
                console.error('[useConnectivityWithSync] Sync failed:', err)
              }
            }, syncDelay)
          }
        } else if (!isConnected && wasConnected) {
          // Just disconnected
          toast.add({
            title: 'Connection lost',
            description: 'Changes will sync when connection is restored.',
            color: 'warning',
            icon: 'i-lucide-wifi-off',
          })
          hasPendingSync.value = true
        }
      },
    )

    // Cleanup
    onUnmounted(() => {
      unsubscribe()
      if (syncTimeout) {
        clearTimeout(syncTimeout)
      }
    })
  }

  return {
    ...connectivity,
    /** Mark that there are pending items to sync */
    markPendingSync: () => {
      hasPendingSync.value = true
    },
    /** Check if there are pending items */
    hasPendingSync: readonly(hasPendingSync),
  }
}
