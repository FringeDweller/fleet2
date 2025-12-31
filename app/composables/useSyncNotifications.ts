/**
 * Sync Notifications Composable (fleet2-xwyp)
 * Shows toast notifications when sync starts, completes, or fails.
 * Tracks sync progress (items synced / total).
 * Provides reactive state: isSyncing, progress, lastSyncTime, errors.
 * Integrates with useOfflineQueue and useConnectivity composables.
 */

import type { QueuedOperation, SyncProgress, SyncResult } from '~/composables/useOfflineQueue'

/** Sync notification state */
export interface SyncNotificationState {
  /** Whether a sync operation is currently in progress */
  isSyncing: Readonly<Ref<boolean>>
  /** Current sync progress */
  progress: Readonly<Ref<SyncProgress | null>>
  /** Timestamp of last successful sync */
  lastSyncTime: Readonly<Ref<Date | null>>
  /** Array of errors from the last sync */
  errors: Readonly<Ref<SyncError[]>>
  /** Total items synced successfully in the last operation */
  lastSyncCount: Readonly<Ref<number>>
  /** Total items that failed in the last operation */
  lastFailCount: Readonly<Ref<number>>
}

/** Sync error with operation details */
export interface SyncError {
  operationId: string
  operationType: string
  message: string
  timestamp: Date
}

/** Options for the sync notifications composable */
export interface UseSyncNotificationsOptions {
  /** Whether to show toast notifications (default: true) */
  showToasts?: boolean
  /** Duration for success toasts in milliseconds (default: 3000) */
  successDuration?: number
  /** Duration for error toasts in milliseconds (default: 5000) */
  errorDuration?: number
}

const DEFAULT_OPTIONS: Required<UseSyncNotificationsOptions> = {
  showToasts: true,
  successDuration: 3000,
  errorDuration: 5000,
}

export function useSyncNotifications(options: UseSyncNotificationsOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }

  const toast = useToast()
  const offlineQueue = useOfflineQueue()
  const connectivity = useConnectivity()

  // Reactive state
  const isSyncing = ref(false)
  const progress = ref<SyncProgress | null>(null)
  const lastSyncTime = ref<Date | null>(null)
  const errors = ref<SyncError[]>([])
  const lastSyncCount = ref(0)
  const lastFailCount = ref(0)

  // Track sync start for notification timing
  let syncStartTime: Date | null = null

  /**
   * Show a toast notification for sync start
   */
  const notifySyncStart = (total: number) => {
    if (!config.showToasts) return

    toast.add({
      id: 'sync-progress',
      title: 'Syncing...',
      description: `Syncing ${total} pending change${total !== 1 ? 's' : ''}`,
      color: 'info',
      icon: 'i-lucide-cloud-upload',
    })
  }

  /**
   * Show a toast notification for sync completion
   */
  const notifySyncComplete = (result: SyncResult) => {
    if (!config.showToasts) return

    const successCount = result.success.length
    const failedCount = result.failed.length

    // Remove the progress toast
    toast.remove('sync-progress')

    if (failedCount === 0 && successCount > 0) {
      toast.add({
        title: 'Sync Complete',
        description: `Successfully synced ${successCount} item${successCount !== 1 ? 's' : ''}`,
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } else if (failedCount > 0 && successCount > 0) {
      toast.add({
        title: 'Sync Partially Complete',
        description: `Synced ${successCount} item${successCount !== 1 ? 's' : ''}, ${failedCount} failed`,
        color: 'warning',
        icon: 'i-lucide-alert-triangle',
      })
    } else if (failedCount > 0 && successCount === 0) {
      toast.add({
        title: 'Sync Failed',
        description: `Failed to sync ${failedCount} item${failedCount !== 1 ? 's' : ''}`,
        color: 'error',
        icon: 'i-lucide-x-circle',
      })
    }
  }

  /**
   * Show a toast notification for sync error
   */
  const notifySyncError = (error: string, operation: QueuedOperation) => {
    if (!config.showToasts) return

    // Add to errors array
    errors.value.push({
      operationId: operation.id,
      operationType: operation.type,
      message: error,
      timestamp: new Date(),
    })
  }

  /**
   * Show a toast notification when connection is restored
   */
  const notifyConnectionRestored = () => {
    if (!config.showToasts) return

    const pendingCount = offlineQueue.queueCount.value
    if (pendingCount > 0) {
      toast.add({
        title: 'Back Online',
        description: `Connection restored. ${pendingCount} change${pendingCount !== 1 ? 's' : ''} will sync automatically.`,
        color: 'success',
        icon: 'i-lucide-wifi',
      })
    }
  }

  /**
   * Show a toast notification when connection is lost
   */
  const notifyConnectionLost = () => {
    if (!config.showToasts) return

    toast.add({
      title: 'Offline',
      description: 'Changes will be saved locally and synced when back online.',
      color: 'warning',
      icon: 'i-lucide-wifi-off',
    })
  }

  /**
   * Trigger a manual sync and handle notifications
   */
  const triggerSync = async () => {
    if (isSyncing.value) {
      toast.add({
        title: 'Sync in progress',
        description: 'Please wait for the current sync to complete.',
        color: 'info',
        icon: 'i-lucide-loader-2',
      })
      return
    }

    if (!connectivity.isConnected.value) {
      toast.add({
        title: 'Offline',
        description: 'Cannot sync while offline. Changes will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })
      return
    }

    const pendingItems = await offlineQueue.getPendingItems()
    if (pendingItems.length === 0) {
      toast.add({
        title: 'Nothing to sync',
        description: 'All changes are already synced.',
        color: 'info',
        icon: 'i-lucide-check-circle',
      })
      return
    }

    // Trigger the sync through the offline queue
    await offlineQueue.triggerSync()
  }

  /**
   * Clear all errors
   */
  const clearErrors = () => {
    errors.value = []
  }

  /**
   * Get a human-readable time since last sync
   */
  const getTimeSinceLastSync = (): string | null => {
    if (!lastSyncTime.value) return null

    const now = new Date()
    const diff = now.getTime() - lastSyncTime.value.getTime()

    if (diff < 60000) {
      return 'Just now'
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(diff / 86400000)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    }
  }

  // Set up listeners on client-side
  if (import.meta.client) {
    // Listen for sync progress updates
    const unsubscribeProgress = offlineQueue.onSyncProgress((syncProgress) => {
      progress.value = syncProgress
    })

    // Listen for sync completion
    const unsubscribeComplete = offlineQueue.onSyncComplete((result) => {
      isSyncing.value = false
      progress.value = null
      lastSyncTime.value = new Date()
      lastSyncCount.value = result.success.length
      lastFailCount.value = result.failed.length
      syncStartTime = null

      notifySyncComplete(result)
    })

    // Listen for sync errors
    const unsubscribeError = offlineQueue.onSyncError((error, operation) => {
      notifySyncError(error, operation)
    })

    // Listen for connectivity changes
    const unsubscribeConnectivity = connectivity.onConnectivityChange(
      ({ isConnected, wasConnected }) => {
        if (isConnected && !wasConnected) {
          notifyConnectionRestored()
        } else if (!isConnected && wasConnected) {
          notifyConnectionLost()
        }
      },
    )

    // Watch for sync in progress from offlineQueue
    watch(offlineQueue.syncInProgress, (syncing) => {
      if (syncing && !isSyncing.value) {
        isSyncing.value = true
        syncStartTime = new Date()
        errors.value = []

        // Get pending count for notification
        offlineQueue.getPendingItems().then((items) => {
          notifySyncStart(items.length)
        })
      } else if (!syncing && isSyncing.value) {
        isSyncing.value = false
      }
    })

    // Update lastSyncTime from offlineQueue
    watch(offlineQueue.lastSyncAt, (newTime) => {
      if (newTime) {
        lastSyncTime.value = newTime
      }
    })

    // Clean up on unmount
    onUnmounted(() => {
      unsubscribeProgress()
      unsubscribeComplete()
      unsubscribeError()
      unsubscribeConnectivity()
    })
  }

  return {
    // State
    isSyncing: readonly(isSyncing),
    progress: readonly(progress),
    lastSyncTime: readonly(lastSyncTime),
    errors: readonly(errors),
    lastSyncCount: readonly(lastSyncCount),
    lastFailCount: readonly(lastFailCount),

    // Computed
    pendingCount: offlineQueue.queueCount,
    isOnline: connectivity.isConnected,
    connectionQuality: connectivity.quality,

    // Actions
    triggerSync,
    clearErrors,
    getTimeSinceLastSync,
  }
}
