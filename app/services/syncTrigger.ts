/**
 * Sync Trigger Service (US-7.4.1b)
 * Watches network status and triggers sync queue processing when connectivity is restored.
 * Provides debounced reconnection handling to ensure stable connection before sync.
 */

import { type NetworkStatusChangeCallback, useNetworkStatus } from '~/composables/useNetworkStatus'
import { isSyncInProgress, syncPendingOperations } from '~/services/syncService'

// Debounce delay in milliseconds - wait for stable connection
const RECONNECT_DEBOUNCE_MS = 2000

// Sync trigger state
interface SyncTriggerState {
  /** Whether the sync trigger service is active */
  isActive: boolean
  /** Debounce timeout handle */
  debounceTimeout: ReturnType<typeof setTimeout> | null
  /** Timestamp of last triggered sync */
  lastSyncTriggeredAt: Date | null
  /** Number of syncs triggered since service start */
  syncTriggerCount: number
  /** Unsubscribe function for network status listener */
  unsubscribe: (() => void) | null
}

// Global state for the service (singleton pattern)
const state: SyncTriggerState = {
  isActive: false,
  debounceTimeout: null,
  lastSyncTriggeredAt: null,
  syncTriggerCount: 0,
  unsubscribe: null,
}

/**
 * Log sync trigger events with consistent prefix
 */
function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const prefix = '[SyncTrigger]'
  const logMessage = `${prefix} ${message}`

  switch (level) {
    case 'debug':
      console.debug(logMessage, data ?? '')
      break
    case 'info':
      console.info(logMessage, data ?? '')
      break
    case 'warn':
      console.warn(logMessage, data ?? '')
      break
    case 'error':
      console.error(logMessage, data ?? '')
      break
  }
}

/**
 * Clear any pending debounce timeout
 */
function clearDebounce(): void {
  if (state.debounceTimeout) {
    clearTimeout(state.debounceTimeout)
    state.debounceTimeout = null
    log('debug', 'Cleared debounce timeout')
  }
}

/**
 * Trigger sync after verifying conditions
 */
async function triggerSync(): Promise<void> {
  log('info', 'Evaluating sync trigger conditions...')

  // Check if sync is already in progress
  if (isSyncInProgress()) {
    log('info', 'Sync already in progress, skipping trigger')
    return
  }

  // Get queue to check for pending items
  const offlineQueue = useOfflineQueue()
  const pendingItems = await offlineQueue.getPendingItems()

  if (pendingItems.length === 0) {
    log('info', 'No pending items in queue, skipping sync')
    return
  }

  log('info', `Triggering sync for ${pendingItems.length} pending item(s)`)
  state.lastSyncTriggeredAt = new Date()
  state.syncTriggerCount++

  try {
    const result = await syncPendingOperations()
    log('info', 'Sync completed', {
      synced: result.synced,
      failed: result.failed,
      triggerCount: state.syncTriggerCount,
    })
  } catch (error) {
    log('error', 'Sync failed with error', error)
  }
}

/**
 * Handle network status change event
 */
const handleNetworkStatusChange: NetworkStatusChangeCallback = ({
  isOnline,
  wasOnline,
  connectionType,
}) => {
  log('debug', 'Network status changed', { isOnline, wasOnline, connectionType })

  // Clear any existing debounce when status changes
  clearDebounce()

  // Only trigger sync when transitioning from offline to online
  if (isOnline && !wasOnline) {
    log(
      'info',
      `Connection restored (type: ${connectionType ?? 'unknown'}), debouncing before sync...`,
    )

    // Debounce to wait for stable connection
    state.debounceTimeout = setTimeout(async () => {
      log('info', 'Debounce complete, proceeding with sync check')
      state.debounceTimeout = null

      // Re-verify we're still online before triggering
      const networkStatus = useNetworkStatus()
      if (networkStatus.isOnline.value) {
        await triggerSync()
      } else {
        log('warn', 'Connection lost during debounce period, aborting sync')
      }
    }, RECONNECT_DEBOUNCE_MS)
  } else if (!isOnline && wasOnline) {
    log('info', 'Connection lost, sync will trigger when back online')
  }
}

/**
 * Start the sync trigger service
 * Sets up network status listener to automatically trigger sync on reconnection
 */
export function startSyncTrigger(): void {
  // Only run on client side
  if (!import.meta.client) {
    log('debug', 'Skipping start - not on client')
    return
  }

  if (state.isActive) {
    log('debug', 'Sync trigger service already active')
    return
  }

  log('info', 'Starting sync trigger service')

  const networkStatus = useNetworkStatus()
  state.unsubscribe = networkStatus.onStatusChange(handleNetworkStatusChange)
  state.isActive = true

  log('info', 'Sync trigger service started', {
    isOnline: networkStatus.isOnline.value,
    debounceMs: RECONNECT_DEBOUNCE_MS,
  })
}

/**
 * Stop the sync trigger service
 * Cleans up network status listener and any pending debounce
 */
export function stopSyncTrigger(): void {
  if (!state.isActive) {
    log('debug', 'Sync trigger service not active')
    return
  }

  log('info', 'Stopping sync trigger service')

  clearDebounce()

  if (state.unsubscribe) {
    state.unsubscribe()
    state.unsubscribe = null
  }

  state.isActive = false
  log('info', 'Sync trigger service stopped', {
    totalSyncsTriggered: state.syncTriggerCount,
  })
}

/**
 * Get current sync trigger service state
 */
export function getSyncTriggerState(): Readonly<{
  isActive: boolean
  lastSyncTriggeredAt: Date | null
  syncTriggerCount: number
  hasPendingDebounce: boolean
}> {
  return {
    isActive: state.isActive,
    lastSyncTriggeredAt: state.lastSyncTriggeredAt,
    syncTriggerCount: state.syncTriggerCount,
    hasPendingDebounce: state.debounceTimeout !== null,
  }
}

/**
 * Composable for using the sync trigger service in Vue components
 * Automatically starts the service on mount and stops on unmount
 */
export function useSyncTrigger() {
  // Reactive state refs
  const isActive = ref(state.isActive)
  const lastSyncTriggeredAt = ref<Date | null>(state.lastSyncTriggeredAt)
  const syncTriggerCount = ref(state.syncTriggerCount)
  const hasPendingDebounce = ref(state.debounceTimeout !== null)

  // Update reactive refs periodically to sync with global state
  const updateRefs = () => {
    isActive.value = state.isActive
    lastSyncTriggeredAt.value = state.lastSyncTriggeredAt
    syncTriggerCount.value = state.syncTriggerCount
    hasPendingDebounce.value = state.debounceTimeout !== null
  }

  // Only run on client
  if (import.meta.client) {
    // Start the service if not already running
    onMounted(() => {
      startSyncTrigger()
      updateRefs()
    })

    // Set up a watcher to update refs when they might change
    // Use an interval since the state changes are from async operations
    let updateInterval: ReturnType<typeof setInterval> | null = null

    onMounted(() => {
      updateInterval = setInterval(updateRefs, 1000)
    })

    // Clean up on unmount
    onUnmounted(() => {
      if (updateInterval) {
        clearInterval(updateInterval)
      }
      // Note: We don't stop the service on unmount as it should persist
      // across component lifecycles. The service should be stopped
      // explicitly when the app is closing.
    })
  }

  return {
    // State (readonly)
    isActive: readonly(isActive),
    lastSyncTriggeredAt: readonly(lastSyncTriggeredAt),
    syncTriggerCount: readonly(syncTriggerCount),
    hasPendingDebounce: readonly(hasPendingDebounce),

    // Actions
    start: startSyncTrigger,
    stop: stopSyncTrigger,
    getState: getSyncTriggerState,
  }
}
