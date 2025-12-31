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

  // Reactive state
  const queueCount = ref(0)
  const isInitialized = ref(false)

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

  // Initialize on client-side
  if (import.meta.client) {
    initialize()
  }

  return {
    // State
    queueCount: getQueueCount,
    isOnline,
    isInitialized: readonly(isInitialized),

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

    // Maintenance
    clearFailed,
    clearAll,
    initialize,
  }
}
