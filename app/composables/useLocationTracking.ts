/**
 * Location Tracking Composable
 *
 * Handles background GPS tracking for operator sessions. Records are captured
 * at configurable intervals, stored locally for offline support, and synced
 * to the server when online.
 *
 * @requirement REQ-1201
 */

interface LocationRecord {
  id: string
  operatorSessionId: string
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  speed: number | null
  heading: number | null
  recordedAt: string
  synced: boolean
}

interface TrackingOptions {
  // Interval in minutes (1-60)
  intervalMinutes?: number
  // Use high accuracy GPS (more battery)
  highAccuracy?: boolean
  // Maximum age of cached position in ms
  maximumAge?: number
  // Timeout for getting position in ms
  timeout?: number
}

const STORAGE_KEY = 'fleet-location-records'
const DEFAULT_INTERVAL = 5 // 5 minutes
const MAX_CACHED_RECORDS = 500

export function useLocationTracking() {
  const isTracking = ref(false)
  const isSupported = ref(false)
  const currentPosition = ref<GeolocationPosition | null>(null)
  const lastError = ref<GeolocationPositionError | null>(null)
  const pendingSyncCount = ref(0)
  const isOnline = ref(true)

  // Check for Geolocation API support
  if (import.meta.client) {
    isSupported.value = 'geolocation' in navigator
    isOnline.value = navigator.onLine

    // Listen for online/offline events
    window.addEventListener('online', () => {
      isOnline.value = true
      syncPendingRecords()
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
  }

  let watchId: number | null = null
  let intervalId: NodeJS.Timeout | null = null
  let currentSessionId: string | null = null
  let currentAssetId: string | null = null

  /**
   * Load pending records from local storage
   */
  function loadPendingRecords(): LocationRecord[] {
    if (!import.meta.client) return []
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    try {
      const records = JSON.parse(stored) as LocationRecord[]
      pendingSyncCount.value = records.filter((r) => !r.synced).length
      return records
    } catch {
      return []
    }
  }

  /**
   * Save records to local storage
   */
  function saveRecords(records: LocationRecord[]) {
    if (!import.meta.client) return
    // Keep only the last MAX_CACHED_RECORDS
    const trimmed = records.slice(-MAX_CACHED_RECORDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    pendingSyncCount.value = trimmed.filter((r) => !r.synced).length
  }

  /**
   * Add a new location record
   */
  function addRecord(position: GeolocationPosition) {
    if (!currentSessionId || !currentAssetId) return

    const record: LocationRecord = {
      id: crypto.randomUUID(),
      operatorSessionId: currentSessionId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed ? position.coords.speed * 3.6 : null, // m/s to km/h
      heading: position.coords.heading,
      recordedAt: new Date(position.timestamp).toISOString(),
      synced: false,
    }

    const records = loadPendingRecords()
    records.push(record)
    saveRecords(records)

    // Try to sync if online
    if (isOnline.value) {
      syncPendingRecords()
    }
  }

  /**
   * Sync pending records to server
   */
  async function syncPendingRecords() {
    if (!import.meta.client || !isOnline.value || !currentAssetId) return

    const records = loadPendingRecords()
    const pending = records.filter((r) => !r.synced)

    if (pending.length === 0) return

    try {
      const response = await $fetch('/api/locations/batch', {
        method: 'POST',
        body: {
          assetId: currentAssetId,
          records: pending.map((r) => ({
            id: r.id,
            operatorSessionId: r.operatorSessionId,
            latitude: r.latitude,
            longitude: r.longitude,
            accuracy: r.accuracy,
            altitude: r.altitude,
            speed: r.speed,
            heading: r.heading,
            recordedAt: r.recordedAt,
          })),
        },
      })

      if (response.success) {
        // Mark records as synced
        const syncedIds = new Set(pending.map((r) => r.id))
        const updated = records.map((r) => (syncedIds.has(r.id) ? { ...r, synced: true } : r))

        // Remove old synced records (keep last 50 for history)
        const synced = updated.filter((r) => r.synced)
        const unsynced = updated.filter((r) => !r.synced)
        const toKeep = [...unsynced, ...synced.slice(-50)]

        saveRecords(toKeep)
      }
    } catch (error) {
      console.error('Failed to sync location records:', error)
    }
  }

  /**
   * Get current position once
   */
  function getCurrentPosition(options?: TrackingOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!isSupported.value) {
        reject(new Error('Geolocation is not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentPosition.value = position
          lastError.value = null
          resolve(position)
        },
        (error) => {
          lastError.value = error
          reject(error)
        },
        {
          enableHighAccuracy: options?.highAccuracy ?? false,
          maximumAge: options?.maximumAge ?? 60000, // 1 minute cache
          timeout: options?.timeout ?? 30000, // 30 second timeout
        },
      )
    })
  }

  /**
   * Start background location tracking
   */
  async function startTracking(
    sessionId: string,
    assetId: string,
    options?: TrackingOptions,
  ): Promise<boolean> {
    if (!isSupported.value) {
      console.error('Geolocation is not supported')
      return false
    }

    if (isTracking.value) {
      console.warn('Location tracking is already active')
      return true
    }

    currentSessionId = sessionId
    currentAssetId = assetId

    const intervalMinutes = options?.intervalMinutes ?? DEFAULT_INTERVAL
    const intervalMs = intervalMinutes * 60 * 1000

    try {
      // Get initial position
      const position = await getCurrentPosition(options)
      addRecord(position)

      // Start interval-based tracking (battery optimized)
      intervalId = setInterval(async () => {
        try {
          const pos = await getCurrentPosition(options)
          addRecord(pos)
        } catch (error) {
          console.error('Failed to get position:', error)
        }
      }, intervalMs)

      // Also use watchPosition for movement detection (with significant change threshold)
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          currentPosition.value = position
          lastError.value = null

          // Only record if we've moved significantly (>50m from last record)
          const records = loadPendingRecords()
          const lastRecord = records[records.length - 1]

          if (lastRecord) {
            const distance = calculateDistance(
              lastRecord.latitude,
              lastRecord.longitude,
              position.coords.latitude,
              position.coords.longitude,
            )

            // Record if moved more than 50 meters
            if (distance > 0.05) {
              addRecord(position)
            }
          }
        },
        (error) => {
          lastError.value = error
          console.error('Watch position error:', error)
        },
        {
          enableHighAccuracy: options?.highAccuracy ?? false,
          maximumAge: options?.maximumAge ?? 60000,
          timeout: options?.timeout ?? 30000,
        },
      )

      isTracking.value = true
      return true
    } catch (error) {
      console.error('Failed to start location tracking:', error)
      return false
    }
  }

  /**
   * Stop location tracking
   */
  function stopTracking() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }

    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }

    isTracking.value = false
    currentSessionId = null

    // Final sync attempt
    if (isOnline.value) {
      syncPendingRecords()
    }
  }

  /**
   * Calculate distance between two points in km (Haversine formula)
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Clear all stored records
   */
  function clearRecords() {
    if (!import.meta.client) return
    localStorage.removeItem(STORAGE_KEY)
    pendingSyncCount.value = 0
  }

  /**
   * Get stored records for debugging/display
   */
  function getStoredRecords(): LocationRecord[] {
    return loadPendingRecords()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopTracking()
  })

  return {
    // State
    isTracking: readonly(isTracking),
    isSupported: readonly(isSupported),
    isOnline: readonly(isOnline),
    currentPosition: readonly(currentPosition),
    lastError: readonly(lastError),
    pendingSyncCount: readonly(pendingSyncCount),

    // Actions
    startTracking,
    stopTracking,
    getCurrentPosition,
    syncPendingRecords,
    clearRecords,
    getStoredRecords,
  }
}
