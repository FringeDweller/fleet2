/**
 * Operator Session Composable
 * Manages operator log-on/log-off functionality with offline support
 */

interface Asset {
  id: string
  assetNumber: string
  make?: string | null
  model?: string | null
  year?: number | null
  licensePlate?: string | null
  imageUrl?: string | null
  mileage?: string | null
  operationalHours?: string | null
  category?: { id: string; name: string } | null
}

interface Operator {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
}

interface OperatorSession {
  id: string
  organisationId: string
  assetId: string
  operatorId: string
  startTime: string
  endTime?: string | null
  startOdometer?: string | null
  endOdometer?: string | null
  startHours?: string | null
  endHours?: string | null
  startLatitude?: string | null
  startLongitude?: string | null
  startLocationName?: string | null
  endLatitude?: string | null
  endLongitude?: string | null
  endLocationName?: string | null
  tripDistance?: string | null
  tripDurationMinutes?: number | null
  status: 'active' | 'completed' | 'cancelled'
  syncStatus: 'synced' | 'pending' | 'failed'
  notes?: string | null
  asset: Asset
  operator: Operator
}

interface LogOnPayload {
  assetId: string
  startOdometer?: number | null
  startHours?: number | null
  startLatitude?: number | null
  startLongitude?: number | null
  startLocationName?: string | null
  notes?: string | null
}

interface LogOffPayload {
  sessionId?: string
  endOdometer?: number | null
  endHours?: number | null
  endLatitude?: number | null
  endLongitude?: number | null
  endLocationName?: string | null
  notes?: string | null
}

interface TripSummary {
  tripDistance: string | null
  tripDuration: string
  tripDurationMinutes: number
  startTime: string
  endTime: Date
  startOdometer: number | null
  endOdometer: number | null
  startHours: number | null
  endHours: number | null
}

interface OfflineSession {
  id: string
  payload: LogOnPayload | LogOffPayload
  type: 'log-on' | 'log-off'
  timestamp: string
  retries: number
}

const OFFLINE_QUEUE_KEY = 'fleet2_operator_session_queue'
const CURRENT_SESSION_KEY = 'fleet2_current_operator_session'

export function useOperatorSession() {
  const isOnline = useOnline()
  const toast = useToast()

  // State
  const currentSession = useState<OperatorSession | null>('operatorSession', () => null)
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const sessionDuration = ref<{ minutes: number; formatted: string } | null>(null)

  // Track duration of active session
  let durationInterval: ReturnType<typeof setInterval> | null = null

  const updateDuration = () => {
    if (!currentSession.value || currentSession.value.status !== 'active') {
      sessionDuration.value = null
      return
    }
    const now = new Date()
    const startTime = new Date(currentSession.value.startTime)
    const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60))
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    sessionDuration.value = {
      minutes: durationMinutes,
      formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    }
  }

  const startDurationTracking = () => {
    if (durationInterval) {
      clearInterval(durationInterval)
    }
    updateDuration()
    durationInterval = setInterval(updateDuration, 60000) // Update every minute
  }

  const stopDurationTracking = () => {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    sessionDuration.value = null
  }

  // Offline queue management
  const getOfflineQueue = (): OfflineSession[] => {
    if (!import.meta.client) return []
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return queue ? JSON.parse(queue) : []
  }

  const saveOfflineQueue = (queue: OfflineSession[]) => {
    if (!import.meta.client) return
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  }

  const addToOfflineQueue = (
    type: 'log-on' | 'log-off',
    payload: LogOnPayload | LogOffPayload,
  ): string => {
    const queue = getOfflineQueue()
    const id = crypto.randomUUID()
    queue.push({
      id,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retries: 0,
    })
    saveOfflineQueue(queue)
    return id
  }

  const removeFromOfflineQueue = (id: string) => {
    const queue = getOfflineQueue()
    const filtered = queue.filter((item) => item.id !== id)
    saveOfflineQueue(filtered)
  }

  // Cache current session for offline access
  const cacheCurrentSession = (session: OperatorSession | null) => {
    if (!import.meta.client) return
    if (session) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY)
    }
  }

  const getCachedSession = (): OperatorSession | null => {
    if (!import.meta.client) return null
    const cached = localStorage.getItem(CURRENT_SESSION_KEY)
    return cached ? JSON.parse(cached) : null
  }

  // Fetch current active session
  const fetchActiveSession = async (): Promise<void> => {
    isLoading.value = true
    try {
      const response = await $fetch<{
        hasActiveSession: boolean
        session: OperatorSession | null
        currentDuration?: { minutes: number; formatted: string }
      }>('/api/operator-sessions/active')

      if (response.hasActiveSession && response.session) {
        currentSession.value = response.session
        cacheCurrentSession(response.session)
        startDurationTracking()
      } else {
        currentSession.value = null
        cacheCurrentSession(null)
        stopDurationTracking()
      }
    } catch (error) {
      console.error('Failed to fetch active session:', error)
      // Try to load from cache if offline
      if (!isOnline.value) {
        const cached = getCachedSession()
        if (cached && cached.status === 'active') {
          currentSession.value = cached
          startDurationTracking()
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  // Log on to an asset
  const logOn = async (
    payload: LogOnPayload,
  ): Promise<{ success: boolean; session?: OperatorSession; error?: string }> => {
    isLoading.value = true

    try {
      if (!isOnline.value) {
        // Queue for later sync
        addToOfflineQueue('log-on', {
          ...payload,
          startTime: new Date().toISOString(),
        } as LogOnPayload & { startTime: string })

        // Create an optimistic session for UI
        const optimisticSession: OperatorSession = {
          id: crypto.randomUUID(),
          organisationId: '',
          assetId: payload.assetId,
          operatorId: '',
          startTime: new Date().toISOString(),
          startOdometer: payload.startOdometer?.toString() ?? null,
          startHours: payload.startHours?.toString() ?? null,
          startLatitude: payload.startLatitude?.toString() ?? null,
          startLongitude: payload.startLongitude?.toString() ?? null,
          startLocationName: payload.startLocationName ?? null,
          status: 'active',
          syncStatus: 'pending',
          notes: payload.notes ?? null,
          asset: { id: payload.assetId, assetNumber: 'Loading...' },
          operator: { id: '', firstName: '', lastName: '', email: '' },
        }

        currentSession.value = optimisticSession
        cacheCurrentSession(optimisticSession)
        startDurationTracking()

        toast.add({
          title: 'Session started (offline)',
          description: 'Your session will sync when you are back online.',
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })

        return { success: true, session: optimisticSession }
      }

      const response = await $fetch<{
        session: OperatorSession
        message: string
      }>('/api/operator-sessions/log-on', {
        method: 'POST',
        body: payload,
      })

      currentSession.value = response.session
      cacheCurrentSession(response.session)
      startDurationTracking()

      return { success: true, session: response.session }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string } }
      const errorMessage = err.data?.statusMessage || 'Failed to log on'
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  // Log off from current session
  const logOff = async (
    payload: LogOffPayload = {},
  ): Promise<{ success: boolean; summary?: TripSummary; error?: string }> => {
    isLoading.value = true

    try {
      if (!isOnline.value) {
        // Queue for later sync
        addToOfflineQueue('log-off', {
          ...payload,
          sessionId: currentSession.value?.id,
          endTime: new Date().toISOString(),
        } as LogOffPayload & { endTime: string })

        // Clear the local session
        const prevSession = currentSession.value
        currentSession.value = null
        cacheCurrentSession(null)
        stopDurationTracking()

        toast.add({
          title: 'Session ended (offline)',
          description: 'Your trip data will sync when you are back online.',
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })

        // Create a fake summary for UI
        const fakeSummary: TripSummary = {
          tripDistance: null,
          tripDuration: sessionDuration.value?.formatted ?? '0m',
          tripDurationMinutes: sessionDuration.value?.minutes ?? 0,
          startTime: prevSession?.startTime ?? new Date().toISOString(),
          endTime: new Date(),
          startOdometer: prevSession?.startOdometer ? parseFloat(prevSession.startOdometer) : null,
          endOdometer: payload.endOdometer ?? null,
          startHours: prevSession?.startHours ? parseFloat(prevSession.startHours) : null,
          endHours: payload.endHours ?? null,
        }

        return { success: true, summary: fakeSummary }
      }

      const response = await $fetch<{
        session: OperatorSession
        summary: TripSummary
        message: string
      }>('/api/operator-sessions/log-off', {
        method: 'POST',
        body: payload,
      })

      currentSession.value = null
      cacheCurrentSession(null)
      stopDurationTracking()

      return { success: true, summary: response.summary }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string } }
      const errorMessage = err.data?.statusMessage || 'Failed to log off'
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  // Sync offline queue
  const syncOfflineQueue = async (): Promise<void> => {
    if (!isOnline.value) return

    const queue = getOfflineQueue()
    if (queue.length === 0) return

    isSyncing.value = true

    for (const item of queue) {
      try {
        if (item.type === 'log-on') {
          await $fetch('/api/operator-sessions/log-on', {
            method: 'POST',
            body: {
              ...item.payload,
              syncStatus: 'synced',
            },
          })
        } else {
          await $fetch('/api/operator-sessions/log-off', {
            method: 'POST',
            body: {
              ...item.payload,
              syncStatus: 'synced',
            },
          })
        }

        removeFromOfflineQueue(item.id)
      } catch (error) {
        console.error(`Failed to sync offline session ${item.id}:`, error)
        // Increment retry count
        const updatedQueue = getOfflineQueue()
        const idx = updatedQueue.findIndex((q) => q.id === item.id)
        if (idx >= 0 && updatedQueue[idx]) {
          updatedQueue[idx]!.retries++
          saveOfflineQueue(updatedQueue)
        }
      }
    }

    isSyncing.value = false

    // Refresh the active session after sync
    await fetchActiveSession()
  }

  // Get current GPS location
  const getCurrentLocation = async (): Promise<{
    latitude: number
    longitude: number
    locationName?: string
  } | null> => {
    if (!import.meta.client) return null
    if (!navigator.geolocation) return null

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error('Geolocation error:', error)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  // Watch for online status changes to trigger sync
  watch(isOnline, (online) => {
    if (online) {
      syncOfflineQueue()
    }
  })

  // Initialize
  if (import.meta.client) {
    // Check for cached session on initial load
    const cached = getCachedSession()
    if (cached && cached.status === 'active') {
      currentSession.value = cached
      startDurationTracking()
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopDurationTracking()
  })

  return {
    // State
    currentSession: readonly(currentSession),
    sessionDuration: readonly(sessionDuration),
    hasActiveSession: computed(() => currentSession.value?.status === 'active'),
    isLoading: readonly(isLoading),
    isSyncing: readonly(isSyncing),
    pendingOfflineItems: computed(() => getOfflineQueue().length),

    // Actions
    fetchActiveSession,
    logOn,
    logOff,
    syncOfflineQueue,
    getCurrentLocation,
  }
}
