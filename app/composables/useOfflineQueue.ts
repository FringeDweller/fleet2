/**
 * Offline Queue Composable (US-7.3)
 * Stores pending operations in IndexedDB for offline-first support.
 * Supports work orders, inspections, and fuel entries.
 */
import { createStore, del, get, keys, set } from 'idb-keyval'

// Operation types supported by the offline queue
export type OfflineOperationType =
  | 'work_order_create'
  | 'work_order_update'
  | 'inspection_start'
  | 'inspection_submit'
  | 'fuel_entry_create'
  | 'custom_form_submit'

// Status of a queued operation
export type QueuedOperationStatus = 'pending' | 'syncing' | 'failed' | 'conflict'

/**
 * A queued offline operation
 */
export interface QueuedOperation<T = unknown> {
  /** Unique identifier for the queued operation */
  id: string
  /** Type of operation */
  type: OfflineOperationType
  /** The data payload for the operation */
  payload: T
  /** ISO timestamp when the operation was queued */
  queuedAt: string
  /** Number of sync retry attempts */
  retryCount: number
  /** Last error message if sync failed */
  lastError?: string
  /** ISO timestamp of last sync attempt */
  lastAttemptAt?: string
  /** Current status of the operation */
  status: QueuedOperationStatus
  /** Entity ID if this is an update operation */
  entityId?: string
  /** Version/etag of the entity for conflict detection */
  entityVersion?: string
}

// Work order create/update payload types
export interface WorkOrderOfflinePayload {
  assetId: string
  title: string
  description?: string | null
  templateId?: string | null
  assignedToId?: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: 'draft' | 'open'
  dueDate?: string | null
  estimatedDuration?: number | null
  notes?: string | null
  // For updates only
  actualDuration?: number | null
  completionNotes?: string | null
}

// Inspection start payload
export interface InspectionStartOfflinePayload {
  assetId?: string
  scanData?: string
  initiationMethod: 'nfc' | 'qr_code' | 'manual'
  latitude?: number
  longitude?: number
  locationName?: string
  locationAccuracy?: number
}

// Inspection submit payload
export interface InspectionSubmitOfflinePayload {
  inspectionId: string
  items: Array<{
    checklistItemId: string
    result: 'pass' | 'fail' | 'na'
    numericValue?: number
    textValue?: string
    photos?: Array<{
      id: string
      url: string
      caption?: string
      takenAt: string
    }>
    signature?: string
    notes?: string
  }>
  complete: boolean
  notes?: string
  overallResult?: string
}

// Fuel entry payload
export interface FuelEntryOfflinePayload {
  assetId: string
  quantity: number
  unitCost?: number | null
  totalCost?: number | null
  fuelType: 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other'
  odometer?: number | null
  engineHours?: number | null
  vendor?: string | null
  notes?: string | null
  transactionDate: string
  latitude?: number | null
  longitude?: number | null
  locationName?: string | null
  locationAddress?: string | null
  receiptPhotoPath?: string | null
  operatorSessionId?: string | null
}

// Custom form submission payload
export interface CustomFormSubmitOfflinePayload {
  formId: string
  versionId?: string
  contextType?: string
  contextId?: string
  responses: Record<string, unknown>
  status: 'draft' | 'submitted'
  notes?: string
}

// Constants
const STORE_NAME = 'fleet-offline-queue'
const MAX_RETRY_COUNT = 5
const QUEUE_KEY_PREFIX = 'op_'

// Sync progress type
export interface SyncProgress {
  completed: number
  total: number
  current: QueuedOperation | null
}

// Sync result type
export interface SyncResult {
  success: QueuedOperation[]
  failed: Array<{ operation: QueuedOperation; error: string }>
}

// Sync callback types
export type SyncProgressCallback = (progress: SyncProgress) => void
export type SyncCompleteCallback = (result: SyncResult) => void
export type SyncErrorCallback = (error: string, operation: QueuedOperation) => void

// Create custom IndexedDB store for the offline queue
let offlineStore: ReturnType<typeof createStore> | null = null

function getStore() {
  if (!offlineStore && import.meta.client) {
    offlineStore = createStore('fleet2-offline', STORE_NAME)
  }
  return offlineStore
}

export function useOfflineQueue() {
  const isOnline = useOnline()
  const toast = useToast()
  const networkStatus = useNetworkStatus()

  // Reactive state
  const queueCount = ref(0)
  const isInitialized = ref(false)
  const syncInProgress = ref(false)
  const lastSyncAt = ref<Date | null>(null)

  // Sync callbacks registry
  const syncCompleteCallbacks = new Set<SyncCompleteCallback>()
  const syncProgressCallbacks = new Set<SyncProgressCallback>()
  const syncErrorCallbacks = new Set<SyncErrorCallback>()

  // Web Worker instance
  let syncWorker: Worker | null = null

  /**
   * Initialize the queue count on mount
   */
  const initialize = async () => {
    if (!import.meta.client || isInitialized.value) return
    try {
      const store = getStore()
      if (store) {
        const allKeys = await keys(store)
        const opKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_KEY_PREFIX))
        queueCount.value = opKeys.length
        isInitialized.value = true
      }
    } catch (error) {
      console.error('Failed to initialize offline queue:', error)
    }
  }

  /**
   * Add an operation to the queue
   */
  const addToQueue = async <T>(
    type: OfflineOperationType,
    payload: T,
    options?: {
      entityId?: string
      entityVersion?: string
    },
  ): Promise<QueuedOperation<T>> => {
    const store = getStore()
    if (!store) {
      throw new Error('IndexedDB not available')
    }

    const operation: QueuedOperation<T> = {
      id: crypto.randomUUID(),
      type,
      payload,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
      entityId: options?.entityId,
      entityVersion: options?.entityVersion,
    }

    const key = `${QUEUE_KEY_PREFIX}${operation.id}`
    await set(key, operation, store)
    queueCount.value++

    return operation
  }

  /**
   * Get all queued operations
   */
  const getQueuedItems = async (): Promise<QueuedOperation[]> => {
    const store = getStore()
    if (!store) return []

    try {
      const allKeys = await keys(store)
      const opKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_KEY_PREFIX))

      const operations: QueuedOperation[] = []
      for (const key of opKeys) {
        const op = await get<QueuedOperation>(key, store)
        if (op) {
          operations.push(op)
        }
      }

      // Sort by queued time (oldest first)
      return operations.sort(
        (a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
      )
    } catch (error) {
      console.error('Failed to get queued items:', error)
      return []
    }
  }

  /**
   * Get queued items by type
   */
  const getQueuedItemsByType = async (type: OfflineOperationType): Promise<QueuedOperation[]> => {
    const allItems = await getQueuedItems()
    return allItems.filter((op) => op.type === type)
  }

  /**
   * Remove an operation from the queue
   */
  const removeFromQueue = async (id: string): Promise<void> => {
    const store = getStore()
    if (!store) return

    const key = `${QUEUE_KEY_PREFIX}${id}`
    await del(key, store)
    queueCount.value = Math.max(0, queueCount.value - 1)
  }

  /**
   * Update an operation in the queue
   */
  const updateQueuedItem = async (
    id: string,
    updates: Partial<QueuedOperation>,
  ): Promise<QueuedOperation | null> => {
    const store = getStore()
    if (!store) return null

    const key = `${QUEUE_KEY_PREFIX}${id}`
    const existing = await get<QueuedOperation>(key, store)

    if (!existing) return null

    const updated: QueuedOperation = {
      ...existing,
      ...updates,
    }

    await set(key, updated, store)
    return updated
  }

  /**
   * Mark an operation as failed with an error
   */
  const markAsFailed = async (id: string, error: string): Promise<void> => {
    await updateQueuedItem(id, {
      status: 'failed',
      lastError: error,
      lastAttemptAt: new Date().toISOString(),
      retryCount: (await getQueuedItem(id))?.retryCount ?? 0,
    })
  }

  /**
   * Get a single queued item by ID
   */
  const getQueuedItem = async (id: string): Promise<QueuedOperation | null> => {
    const store = getStore()
    if (!store) return null

    const key = `${QUEUE_KEY_PREFIX}${id}`
    return (await get<QueuedOperation>(key, store)) || null
  }

  /**
   * Get the count of queued operations
   */
  const getQueueCount = computed(() => queueCount.value)

  /**
   * Increment retry count for an operation
   */
  const incrementRetryCount = async (id: string): Promise<boolean> => {
    const item = await getQueuedItem(id)
    if (!item) return false

    const newCount = item.retryCount + 1

    if (newCount > MAX_RETRY_COUNT) {
      // Mark as permanently failed
      await updateQueuedItem(id, {
        status: 'failed',
        retryCount: newCount,
        lastAttemptAt: new Date().toISOString(),
        lastError: `Maximum retry count (${MAX_RETRY_COUNT}) exceeded`,
      })
      return false
    }

    await updateQueuedItem(id, {
      retryCount: newCount,
      lastAttemptAt: new Date().toISOString(),
    })
    return true
  }

  /**
   * Clear all failed operations from the queue
   */
  const clearFailed = async (): Promise<number> => {
    const items = await getQueuedItems()
    const failedItems = items.filter((op) => op.status === 'failed')

    for (const item of failedItems) {
      await removeFromQueue(item.id)
    }

    return failedItems.length
  }

  /**
   * Clear all operations from the queue
   */
  const clearAll = async (): Promise<void> => {
    const store = getStore()
    if (!store) return

    const allKeys = await keys(store)
    const opKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_KEY_PREFIX))

    for (const key of opKeys) {
      await del(key, store)
    }

    queueCount.value = 0
  }

  /**
   * Get pending operations (not failed, not syncing)
   */
  const getPendingItems = async (): Promise<QueuedOperation[]> => {
    const items = await getQueuedItems()
    return items.filter((op) => op.status === 'pending')
  }

  /**
   * Get summary of queue by operation type
   */
  const getQueueSummary = async (): Promise<
    Record<OfflineOperationType, { pending: number; failed: number; total: number }>
  > => {
    const items = await getQueuedItems()

    const summary: Record<
      OfflineOperationType,
      { pending: number; failed: number; total: number }
    > = {
      work_order_create: { pending: 0, failed: 0, total: 0 },
      work_order_update: { pending: 0, failed: 0, total: 0 },
      inspection_start: { pending: 0, failed: 0, total: 0 },
      inspection_submit: { pending: 0, failed: 0, total: 0 },
      fuel_entry_create: { pending: 0, failed: 0, total: 0 },
      custom_form_submit: { pending: 0, failed: 0, total: 0 },
    }

    for (const item of items) {
      if (summary[item.type]) {
        summary[item.type].total++
        if (item.status === 'pending') {
          summary[item.type].pending++
        } else if (item.status === 'failed') {
          summary[item.type].failed++
        }
      }
    }

    return summary
  }

  /**
   * Initialize the sync worker
   */
  const initializeSyncWorker = () => {
    if (!import.meta.client || syncWorker) return

    try {
      // Create the sync worker
      syncWorker = new Worker(new URL('../workers/sync.worker.ts', import.meta.url), {
        type: 'module',
      })

      // Handle messages from worker
      syncWorker.onmessage = async (event) => {
        const { type, payload } = event.data

        switch (type) {
          case 'SYNC_PROGRESS': {
            const progress: SyncProgress = payload
            for (const callback of syncProgressCallbacks) {
              try {
                callback(progress)
              } catch (err) {
                console.error('[useOfflineQueue] Sync progress callback error:', err)
              }
            }
            break
          }

          case 'SYNC_ITEM_COMPLETE': {
            // Remove successfully synced item from queue
            const { operationId } = payload
            await removeFromQueue(operationId)
            break
          }

          case 'SYNC_ITEM_FAILED': {
            // Update item status and increment retry count
            const { operationId, error } = payload
            await updateQueuedItem(operationId, {
              status: 'failed',
              lastError: error,
              lastAttemptAt: new Date().toISOString(),
            })
            await incrementRetryCount(operationId)

            // Notify error callbacks
            const failedOp = await getQueuedItem(operationId)
            if (failedOp) {
              for (const callback of syncErrorCallbacks) {
                try {
                  callback(error, failedOp)
                } catch (err) {
                  console.error('[useOfflineQueue] Sync error callback error:', err)
                }
              }
            }
            break
          }

          case 'SYNC_COMPLETE': {
            const result: SyncResult = payload
            syncInProgress.value = false
            lastSyncAt.value = new Date()

            // Refresh queue count
            await initialize()

            // Notify complete callbacks
            for (const callback of syncCompleteCallbacks) {
              try {
                callback(result)
              } catch (err) {
                console.error('[useOfflineQueue] Sync complete callback error:', err)
              }
            }

            // Show toast notification
            if (result.success.length > 0 || result.failed.length > 0) {
              const successCount = result.success.length
              const failedCount = result.failed.length

              if (failedCount === 0) {
                toast.add({
                  title: 'Sync Complete',
                  description: `Successfully synced ${successCount} item${successCount !== 1 ? 's' : ''}`,
                  color: 'success',
                  icon: 'i-lucide-check-circle',
                })
              } else {
                toast.add({
                  title: 'Sync Partial',
                  description: `Synced ${successCount}, failed ${failedCount}`,
                  color: 'warning',
                  icon: 'i-lucide-alert-triangle',
                })
              }
            }
            break
          }

          case 'SYNC_ERROR': {
            const { error, operation } = payload
            console.error('[useOfflineQueue] Sync error:', error, operation)
            for (const callback of syncErrorCallbacks) {
              try {
                callback(error, operation)
              } catch (err) {
                console.error('[useOfflineQueue] Sync error callback error:', err)
              }
            }
            break
          }
        }
      }

      syncWorker.onerror = (error) => {
        console.error('[useOfflineQueue] Worker error:', error)
        syncInProgress.value = false
      }
    } catch (err) {
      console.error('[useOfflineQueue] Failed to initialize sync worker:', err)
    }
  }

  /**
   * Trigger synchronization of pending items
   */
  const triggerSync = async (): Promise<void> => {
    if (!import.meta.client) return
    if (syncInProgress.value) {
      console.log('[useOfflineQueue] Sync already in progress')
      return
    }
    if (!isOnline.value) {
      console.log('[useOfflineQueue] Cannot sync while offline')
      return
    }

    const pendingItems = await getPendingItems()
    if (pendingItems.length === 0) {
      console.log('[useOfflineQueue] No pending items to sync')
      return
    }

    // Mark items as syncing
    for (const item of pendingItems) {
      await updateQueuedItem(item.id, { status: 'syncing' })
    }

    syncInProgress.value = true

    // Initialize worker if needed
    if (!syncWorker) {
      initializeSyncWorker()
    }

    if (syncWorker) {
      // Send items to worker for processing
      syncWorker.postMessage({
        type: 'START_SYNC',
        payload: pendingItems,
      })
    } else {
      // Fallback to main thread sync if worker fails
      console.warn('[useOfflineQueue] Worker unavailable, syncing on main thread')
      await syncOnMainThread(pendingItems)
    }
  }

  /**
   * Fallback sync on main thread (if worker unavailable)
   */
  const syncOnMainThread = async (items: QueuedOperation[]): Promise<void> => {
    const result: SyncResult = { success: [], failed: [] }
    const total = items.length

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item) continue

      // Report progress
      for (const callback of syncProgressCallbacks) {
        try {
          callback({ completed: i, total, current: item })
        } catch (err) {
          console.error('[useOfflineQueue] Progress callback error:', err)
        }
      }

      try {
        await syncSingleOperation(item)
        await removeFromQueue(item.id)
        result.success.push(item)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        await updateQueuedItem(item.id, {
          status: 'failed',
          lastError: errorMessage,
          lastAttemptAt: new Date().toISOString(),
        })
        await incrementRetryCount(item.id)
        result.failed.push({ operation: item, error: errorMessage })

        for (const callback of syncErrorCallbacks) {
          try {
            callback(errorMessage, item)
          } catch (cbErr) {
            console.error('[useOfflineQueue] Error callback error:', cbErr)
          }
        }
      }
    }

    syncInProgress.value = false
    lastSyncAt.value = new Date()

    // Notify complete callbacks
    for (const callback of syncCompleteCallbacks) {
      try {
        callback(result)
      } catch (err) {
        console.error('[useOfflineQueue] Complete callback error:', err)
      }
    }

    // Refresh queue count
    await initialize()
  }

  /**
   * Sync a single operation (used by main thread fallback)
   */
  const syncSingleOperation = async (operation: QueuedOperation): Promise<void> => {
    // Cast payload to a type that $fetch accepts
    const payload = operation.payload as Record<string, unknown>

    switch (operation.type) {
      case 'work_order_create':
        await $fetch('/api/work-orders', {
          method: 'POST',
          body: payload,
        })
        break

      case 'work_order_update':
        if (!operation.entityId) {
          throw new Error('Entity ID required for work order update')
        }
        await fetch(`/api/work-orders/${operation.entityId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        })
        break

      case 'inspection_start':
        await $fetch('/api/inspections/start', {
          method: 'POST',
          body: payload,
        })
        break

      case 'inspection_submit': {
        const inspPayload = payload as { inspectionId: string; items: unknown[] }
        await $fetch(`/api/inspections/${inspPayload.inspectionId}/items`, {
          method: 'POST',
          body: payload,
        })
        break
      }

      case 'fuel_entry_create':
        await $fetch('/api/fuel/transactions', {
          method: 'POST',
          body: payload,
        })
        break

      case 'custom_form_submit':
        await $fetch('/api/custom-form-submissions', {
          method: 'POST',
          body: payload,
        })
        break

      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  /**
   * Register a callback for sync completion
   */
  const onSyncComplete = (callback: SyncCompleteCallback): (() => void) => {
    syncCompleteCallbacks.add(callback)
    return () => {
      syncCompleteCallbacks.delete(callback)
    }
  }

  /**
   * Register a callback for sync progress updates
   */
  const onSyncProgress = (callback: SyncProgressCallback): (() => void) => {
    syncProgressCallbacks.add(callback)
    return () => {
      syncProgressCallbacks.delete(callback)
    }
  }

  /**
   * Register a callback for sync errors
   */
  const onSyncError = (callback: SyncErrorCallback): (() => void) => {
    syncErrorCallbacks.add(callback)
    return () => {
      syncErrorCallbacks.delete(callback)
    }
  }

  /**
   * Stop the sync worker and clean up
   */
  const stopSyncWorker = () => {
    if (syncWorker) {
      syncWorker.terminate()
      syncWorker = null
    }
  }

  // Initialize on client-side
  if (import.meta.client) {
    initialize()

    // Auto-sync when coming online
    const unsubscribe = networkStatus.onStatusChange(({ isOnline: online, wasOnline }) => {
      if (online && !wasOnline) {
        // Just came online, trigger sync after a short delay
        setTimeout(() => {
          triggerSync().catch((err) => {
            console.error('[useOfflineQueue] Auto-sync failed:', err)
          })
        }, 1000) // Wait 1 second for connection to stabilize
      }
    })

    // Clean up on component unmount
    onUnmounted(() => {
      unsubscribe()
      stopSyncWorker()
      syncCompleteCallbacks.clear()
      syncProgressCallbacks.clear()
      syncErrorCallbacks.clear()
    })
  }

  return {
    // State
    queueCount: getQueueCount,
    isOnline,
    isInitialized: readonly(isInitialized),
    syncInProgress: readonly(syncInProgress),
    lastSyncAt: readonly(lastSyncAt),

    // Operations
    addToQueue,
    getQueuedItems,
    getQueuedItemsByType,
    getQueuedItem,
    removeFromQueue,
    updateQueuedItem,
    markAsFailed,
    incrementRetryCount,
    getPendingItems,
    getQueueSummary,

    // Sync operations
    triggerSync,
    onSyncComplete,
    onSyncProgress,
    onSyncError,

    // Maintenance
    clearFailed,
    clearAll,
    initialize,
  }
}
