/**
 * Sync Web Worker (US-7.3)
 * Runs offline queue synchronization in a background thread.
 * Communicates with the main thread via postMessage.
 */

// Define types that match useOfflineQueue.ts
type OfflineOperationType =
  | 'work_order_create'
  | 'work_order_update'
  | 'inspection_start'
  | 'inspection_submit'
  | 'fuel_entry_create'
  | 'custom_form_submit'

type QueuedOperationStatus = 'pending' | 'syncing' | 'failed' | 'conflict'

interface QueuedOperation<T = unknown> {
  id: string
  type: OfflineOperationType
  payload: T
  queuedAt: string
  retryCount: number
  lastError?: string
  lastAttemptAt?: string
  status: QueuedOperationStatus
  entityId?: string
  entityVersion?: string
}

// Message types from main thread
interface StartSyncMessage {
  type: 'START_SYNC'
  payload: QueuedOperation[]
}

type WorkerInMessage = StartSyncMessage

// Message types to main thread
interface SyncProgressMessage {
  type: 'SYNC_PROGRESS'
  payload: {
    completed: number
    total: number
    current: QueuedOperation | null
  }
}

interface SyncItemCompleteMessage {
  type: 'SYNC_ITEM_COMPLETE'
  payload: {
    operationId: string
  }
}

interface SyncItemFailedMessage {
  type: 'SYNC_ITEM_FAILED'
  payload: {
    operationId: string
    error: string
  }
}

interface SyncCompleteMessage {
  type: 'SYNC_COMPLETE'
  payload: {
    success: QueuedOperation[]
    failed: Array<{ operation: QueuedOperation; error: string }>
  }
}

interface SyncErrorMessage {
  type: 'SYNC_ERROR'
  payload: {
    error: string
    operation: QueuedOperation | null
  }
}

type WorkerOutMessage =
  | SyncProgressMessage
  | SyncItemCompleteMessage
  | SyncItemFailedMessage
  | SyncCompleteMessage
  | SyncErrorMessage

// Constants
const MAX_CONCURRENT_REQUESTS = 3
const REQUEST_TIMEOUT_MS = 30000 // 30 seconds
const RETRY_DELAY_MS = 1000 // 1 second between retries

/**
 * Get the API endpoint and method for an operation type
 */
function getEndpointConfig(operation: QueuedOperation): {
  url: string
  method: 'POST' | 'PUT'
} {
  switch (operation.type) {
    case 'work_order_create':
      return { url: '/api/work-orders', method: 'POST' }

    case 'work_order_update':
      if (!operation.entityId) {
        throw new Error('Entity ID required for work order update')
      }
      return { url: `/api/work-orders/${operation.entityId}`, method: 'PUT' }

    case 'inspection_start':
      return { url: '/api/inspections/start', method: 'POST' }

    case 'inspection_submit': {
      const payload = operation.payload as { inspectionId: string }
      if (!payload.inspectionId) {
        throw new Error('Inspection ID required for inspection submit')
      }
      return { url: `/api/inspections/${payload.inspectionId}/items`, method: 'POST' }
    }

    case 'fuel_entry_create':
      return { url: '/api/fuel/transactions', method: 'POST' }

    case 'custom_form_submit':
      return { url: '/api/custom-form-submissions', method: 'POST' }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`)
  }
}

/**
 * Execute a single sync operation with timeout
 */
async function executeOperation(operation: QueuedOperation): Promise<void> {
  const { url, method } = getEndpointConfig(operation)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operation.payload),
      signal: controller.signal,
      credentials: 'include', // Include cookies for auth
    })

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.statusMessage) {
          errorMessage = errorData.statusMessage
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage =
            typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)
        }
      } catch {
        // Ignore JSON parse errors
      }

      // Handle specific HTTP status codes
      if (response.status === 409) {
        throw new Error(`Conflict: ${errorMessage}`)
      } else if (response.status === 400) {
        throw new Error(`Validation error: ${errorMessage}`)
      } else if (response.status === 401) {
        throw new Error('Authentication required - please log in again')
      } else if (response.status === 403) {
        throw new Error('Permission denied')
      } else if (response.status >= 500) {
        throw new Error(`Server error: ${errorMessage}`)
      }

      throw new Error(errorMessage)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Process operations with controlled concurrency
 */
async function processOperationsWithConcurrency(
  operations: QueuedOperation[],
  maxConcurrent: number,
): Promise<{
  success: QueuedOperation[]
  failed: Array<{ operation: QueuedOperation; error: string }>
}> {
  const success: QueuedOperation[] = []
  const failed: Array<{ operation: QueuedOperation; error: string }> = []

  // Process in batches to control concurrency
  const batches: QueuedOperation[][] = []
  for (let i = 0; i < operations.length; i += maxConcurrent) {
    batches.push(operations.slice(i, i + maxConcurrent))
  }

  let completedCount = 0
  const total = operations.length

  for (const batch of batches) {
    const batchPromises = batch.map(async (operation) => {
      // Report progress for current item
      postMessage({
        type: 'SYNC_PROGRESS',
        payload: {
          completed: completedCount,
          total,
          current: operation,
        },
      } satisfies SyncProgressMessage)

      try {
        await executeOperation(operation)

        // Report success to main thread
        postMessage({
          type: 'SYNC_ITEM_COMPLETE',
          payload: { operationId: operation.id },
        } satisfies SyncItemCompleteMessage)

        success.push(operation)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)

        // Report failure to main thread
        postMessage({
          type: 'SYNC_ITEM_FAILED',
          payload: {
            operationId: operation.id,
            error: errorMessage,
          },
        } satisfies SyncItemFailedMessage)

        failed.push({ operation, error: errorMessage })
      } finally {
        completedCount++

        // Report updated progress
        postMessage({
          type: 'SYNC_PROGRESS',
          payload: {
            completed: completedCount,
            total,
            current: null,
          },
        } satisfies SyncProgressMessage)
      }
    })

    // Wait for batch to complete before starting next
    await Promise.all(batchPromises)

    // Add a small delay between batches to prevent overwhelming the server
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  return { success, failed }
}

/**
 * Main sync handler
 */
async function handleSync(operations: QueuedOperation[]): Promise<void> {
  if (operations.length === 0) {
    postMessage({
      type: 'SYNC_COMPLETE',
      payload: { success: [], failed: [] },
    } satisfies SyncCompleteMessage)
    return
  }

  try {
    // Sort operations by queued time (oldest first)
    const sortedOperations = [...operations].sort(
      (a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
    )

    // Process operations with controlled concurrency
    const result = await processOperationsWithConcurrency(sortedOperations, MAX_CONCURRENT_REQUESTS)

    // Report completion
    postMessage({
      type: 'SYNC_COMPLETE',
      payload: result,
    } satisfies SyncCompleteMessage)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    postMessage({
      type: 'SYNC_ERROR',
      payload: {
        error: errorMessage,
        operation: null,
      },
    } satisfies SyncErrorMessage)
  }
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const { type, payload } = event.data

  switch (type) {
    case 'START_SYNC':
      handleSync(payload).catch((err) => {
        console.error('[SyncWorker] Unhandled error in handleSync:', err)
        postMessage({
          type: 'SYNC_ERROR',
          payload: {
            error: err instanceof Error ? err.message : String(err),
            operation: null,
          },
        } satisfies SyncErrorMessage)
      })
      break

    default:
      console.warn('[SyncWorker] Unknown message type:', type)
  }
}

// Let main thread know worker is ready
console.log('[SyncWorker] Sync worker initialized')
