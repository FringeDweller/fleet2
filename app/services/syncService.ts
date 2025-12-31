/**
 * Sync Service (US-7.3)
 * Processes queued offline operations when back online.
 * Handles conflicts, retries, and emits sync status events.
 */
import type {
  FuelEntryOfflinePayload,
  InspectionStartOfflinePayload,
  InspectionSubmitOfflinePayload,
  OfflineOperationType,
  QueuedOperation,
  WorkOrderOfflinePayload,
} from '~/composables/useOfflineQueue'

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'synced'

export interface SyncProgress {
  total: number
  completed: number
  failed: number
  current?: QueuedOperation
}

export interface SyncResult {
  success: boolean
  operationId: string
  operationType: OfflineOperationType
  error?: string
  conflictData?: unknown
}

// Event types for sync status updates
export interface SyncEventMap {
  'sync:start': { total: number }
  'sync:progress': SyncProgress
  'sync:complete': { synced: number; failed: number }
  'sync:error': { operationId: string; error: string }
  'sync:conflict': { operationId: string; data: unknown }
}

// Simple event emitter for sync status
class SyncEventEmitter {
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map()

  on<K extends keyof SyncEventMap>(event: K, callback: (data: SyncEventMap[K]) => void): void {
    const callbacks = this.listeners.get(event) || []
    callbacks.push(callback as (data: unknown) => void)
    this.listeners.set(event, callbacks)
  }

  off<K extends keyof SyncEventMap>(event: K, callback: (data: SyncEventMap[K]) => void): void {
    const callbacks = this.listeners.get(event) || []
    const index = callbacks.indexOf(callback as (data: unknown) => void)
    if (index > -1) {
      callbacks.splice(index, 1)
      this.listeners.set(event, callbacks)
    }
  }

  emit<K extends keyof SyncEventMap>(event: K, data: SyncEventMap[K]): void {
    const callbacks = this.listeners.get(event) || []
    for (const callback of callbacks) {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in sync event listener for ${event}:`, error)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

// Create singleton event emitter
const syncEvents = new SyncEventEmitter()

// Sync state
let isSyncing = false
let syncAbortController: AbortController | null = null

/**
 * Process a work order create operation
 */
async function processWorkOrderCreate(
  operation: QueuedOperation<WorkOrderOfflinePayload>,
): Promise<SyncResult> {
  try {
    await $fetch('/api/work-orders', {
      method: 'POST',
      body: operation.payload,
    })

    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string; message?: string }
      statusCode?: number
    }
    const errorMessage =
      err.data?.statusMessage || err.data?.message || 'Failed to create work order'

    // Check for conflict (409)
    if (err.statusCode === 409) {
      return {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        error: errorMessage,
        conflictData: err.data,
      }
    }

    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      error: errorMessage,
    }
  }
}

/**
 * Process a work order update operation
 */
async function processWorkOrderUpdate(
  operation: QueuedOperation<WorkOrderOfflinePayload>,
): Promise<SyncResult> {
  try {
    if (!operation.entityId) {
      throw new Error('Work order ID is required for update')
    }

    await $fetch(`/api/work-orders/${operation.entityId}` as '/api/work-orders/:id', {
      method: 'PUT',
      body: operation.payload,
    })

    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string; message?: string }
      statusCode?: number
    }
    const errorMessage =
      err.data?.statusMessage || err.data?.message || 'Failed to update work order'

    if (err.statusCode === 409) {
      return {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        error: errorMessage,
        conflictData: err.data,
      }
    }

    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      error: errorMessage,
    }
  }
}

/**
 * Process an inspection start operation
 */
async function processInspectionStart(
  operation: QueuedOperation<InspectionStartOfflinePayload>,
): Promise<SyncResult> {
  try {
    await $fetch('/api/inspections/start', {
      method: 'POST',
      body: {
        ...operation.payload,
        offlineData: {
          clientId: operation.id,
          capturedAt: operation.queuedAt,
          wasOffline: true,
        },
      },
    })

    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string; message?: string } }
    const errorMessage =
      err.data?.statusMessage || err.data?.message || 'Failed to start inspection'

    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      error: errorMessage,
    }
  }
}

/**
 * Process an inspection submit operation
 */
async function processInspectionSubmit(
  operation: QueuedOperation<InspectionSubmitOfflinePayload>,
): Promise<SyncResult> {
  try {
    const { inspectionId, ...payload } = operation.payload

    await $fetch(`/api/inspections/${inspectionId}/items`, {
      method: 'POST',
      body: payload,
    })

    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string; message?: string }
      statusCode?: number
    }
    const errorMessage =
      err.data?.statusMessage || err.data?.message || 'Failed to submit inspection'

    if (err.statusCode === 409) {
      return {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        error: errorMessage,
        conflictData: err.data,
      }
    }

    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      error: errorMessage,
    }
  }
}

/**
 * Process a fuel entry create operation
 */
async function processFuelEntryCreate(
  operation: QueuedOperation<FuelEntryOfflinePayload>,
): Promise<SyncResult> {
  try {
    await $fetch('/api/fuel/transactions', {
      method: 'POST',
      body: {
        ...operation.payload,
        syncStatus: 'synced',
      },
    })

    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string; message?: string } }
    const errorMessage =
      err.data?.statusMessage || err.data?.message || 'Failed to create fuel entry'

    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      error: errorMessage,
    }
  }
}

/**
 * Process a single queued operation
 */
async function processOperation(operation: QueuedOperation): Promise<SyncResult> {
  switch (operation.type) {
    case 'work_order_create':
      return processWorkOrderCreate(operation as QueuedOperation<WorkOrderOfflinePayload>)

    case 'work_order_update':
      return processWorkOrderUpdate(operation as QueuedOperation<WorkOrderOfflinePayload>)

    case 'inspection_start':
      return processInspectionStart(operation as QueuedOperation<InspectionStartOfflinePayload>)

    case 'inspection_submit':
      return processInspectionSubmit(operation as QueuedOperation<InspectionSubmitOfflinePayload>)

    case 'fuel_entry_create':
      return processFuelEntryCreate(operation as QueuedOperation<FuelEntryOfflinePayload>)

    default:
      return {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        error: `Unknown operation type: ${operation.type}`,
      }
  }
}

/**
 * Sync all pending operations
 */
export async function syncPendingOperations(): Promise<{
  synced: number
  failed: number
  results: SyncResult[]
}> {
  // Prevent concurrent syncs
  if (isSyncing) {
    return { synced: 0, failed: 0, results: [] }
  }

  const offlineQueue = useOfflineQueue()

  // Check if online
  if (!offlineQueue.isOnline.value) {
    return { synced: 0, failed: 0, results: [] }
  }

  isSyncing = true
  syncAbortController = new AbortController()

  const pendingItems = await offlineQueue.getPendingItems()

  if (pendingItems.length === 0) {
    isSyncing = false
    return { synced: 0, failed: 0, results: [] }
  }

  syncEvents.emit('sync:start', { total: pendingItems.length })

  const results: SyncResult[] = []
  let synced = 0
  let failed = 0

  for (let i = 0; i < pendingItems.length; i++) {
    // Check if sync was aborted
    if (syncAbortController?.signal.aborted) {
      break
    }

    const operation = pendingItems[i]
    if (!operation) continue

    // Update status to syncing
    await offlineQueue.updateQueuedItem(operation.id, { status: 'syncing' })

    syncEvents.emit('sync:progress', {
      total: pendingItems.length,
      completed: i,
      failed,
      current: operation,
    })

    try {
      const result = await processOperation(operation)
      results.push(result)

      if (result.success) {
        // Remove from queue on success
        await offlineQueue.removeFromQueue(operation.id)
        synced++
      } else {
        // Handle failure
        const canRetry = await offlineQueue.incrementRetryCount(operation.id)

        if (result.conflictData) {
          await offlineQueue.updateQueuedItem(operation.id, {
            status: 'conflict',
            lastError: result.error,
          })
          syncEvents.emit('sync:conflict', {
            operationId: operation.id,
            data: result.conflictData,
          })
        } else if (!canRetry) {
          await offlineQueue.markAsFailed(operation.id, result.error || 'Unknown error')
        } else {
          await offlineQueue.updateQueuedItem(operation.id, {
            status: 'pending',
            lastError: result.error,
          })
        }

        syncEvents.emit('sync:error', {
          operationId: operation.id,
          error: result.error || 'Unknown error',
        })
        failed++
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        error: errorMessage,
      })

      await offlineQueue.incrementRetryCount(operation.id)
      await offlineQueue.updateQueuedItem(operation.id, {
        status: 'pending',
        lastError: errorMessage,
      })

      syncEvents.emit('sync:error', {
        operationId: operation.id,
        error: errorMessage,
      })
      failed++
    }
  }

  isSyncing = false
  syncAbortController = null

  syncEvents.emit('sync:complete', { synced, failed })

  return { synced, failed, results }
}

/**
 * Cancel an ongoing sync
 */
export function cancelSync(): void {
  if (syncAbortController) {
    syncAbortController.abort()
  }
}

/**
 * Check if sync is in progress
 */
export function isSyncInProgress(): boolean {
  return isSyncing
}

/**
 * Subscribe to sync events
 */
export function onSyncEvent<K extends keyof SyncEventMap>(
  event: K,
  callback: (data: SyncEventMap[K]) => void,
): () => void {
  syncEvents.on(event, callback)
  return () => syncEvents.off(event, callback)
}

/**
 * Clear all sync event listeners
 */
export function clearSyncListeners(): void {
  syncEvents.clear()
}

/**
 * Composable for using the sync service in components
 */
export function useSyncService() {
  const toast = useToast()
  const offlineQueue = useOfflineQueue()
  const isOnline = useOnline()

  // Reactive sync state
  const syncStatus = ref<SyncStatus>('idle')
  const syncProgress = ref<SyncProgress | null>(null)
  const lastSyncResult = ref<{ synced: number; failed: number } | null>(null)

  // Set up event listeners
  const unsubscribers: Array<() => void> = []

  const setupListeners = () => {
    unsubscribers.push(
      onSyncEvent('sync:start', (data) => {
        syncStatus.value = 'syncing'
        syncProgress.value = {
          total: data.total,
          completed: 0,
          failed: 0,
        }
      }),
    )

    unsubscribers.push(
      onSyncEvent('sync:progress', (data) => {
        syncProgress.value = data
      }),
    )

    unsubscribers.push(
      onSyncEvent('sync:complete', (data) => {
        syncStatus.value = data.failed > 0 ? 'error' : 'synced'
        lastSyncResult.value = data
        syncProgress.value = null

        if (data.synced > 0) {
          toast.add({
            title: 'Sync complete',
            description: `${data.synced} item${data.synced > 1 ? 's' : ''} synced successfully${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
            color: data.failed > 0 ? 'warning' : 'success',
            icon: data.failed > 0 ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle',
          })
        }

        // Reset to idle after a delay
        setTimeout(() => {
          if (syncStatus.value === 'synced') {
            syncStatus.value = 'idle'
          }
        }, 3000)
      }),
    )

    unsubscribers.push(
      onSyncEvent('sync:error', (data) => {
        console.error(`Sync error for operation ${data.operationId}:`, data.error)
      }),
    )

    unsubscribers.push(
      onSyncEvent('sync:conflict', (_data) => {
        toast.add({
          title: 'Sync conflict',
          description: 'Some changes could not be synced due to conflicts. Please review.',
          color: 'warning',
          icon: 'i-lucide-alert-triangle',
        })
      }),
    )
  }

  // Clean up listeners on unmount
  onUnmounted(() => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  })

  // Watch for online status to trigger auto-sync
  watch(isOnline, async (online) => {
    if (online && offlineQueue.queueCount.value > 0) {
      await syncPendingOperations()
    }
  })

  // Trigger sync
  const triggerSync = async () => {
    if (!isOnline.value) {
      toast.add({
        title: 'Offline',
        description: 'Cannot sync while offline. Changes will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })
      return
    }

    if (isSyncInProgress()) {
      toast.add({
        title: 'Sync in progress',
        description: 'Please wait for the current sync to complete.',
        color: 'info',
        icon: 'i-lucide-loader-2',
      })
      return
    }

    return syncPendingOperations()
  }

  // Initialize listeners on mount
  onMounted(() => {
    setupListeners()

    // Auto-sync on mount if online and have pending items
    if (isOnline.value && offlineQueue.queueCount.value > 0) {
      syncPendingOperations()
    }
  })

  return {
    // State
    syncStatus: readonly(syncStatus),
    syncProgress: readonly(syncProgress),
    lastSyncResult: readonly(lastSyncResult),
    isSyncing: computed(() => isSyncInProgress()),
    queueCount: offlineQueue.queueCount,
    isOnline,

    // Actions
    triggerSync,
    cancelSync,
  }
}
