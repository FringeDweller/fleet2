/**
 * Offline API Composable (US-7.3)
 * Wraps API calls to support offline-first behavior.
 * Queues operations when offline and syncs when back online.
 */

import { syncPendingOperations } from '~/services/syncService'
import type {
  FuelEntryOfflinePayload,
  InspectionStartOfflinePayload,
  InspectionSubmitOfflinePayload,
  WorkOrderOfflinePayload,
} from './useOfflineQueue'

export interface OfflineApiResult<T> {
  success: boolean
  data?: T
  error?: string
  isOffline: boolean
  queuedOperationId?: string
}

export function useOfflineApi() {
  const offlineQueue = useOfflineQueue()
  const isOnline = useOnline()
  const toast = useToast()

  /**
   * Create a work order with offline support
   */
  const createWorkOrder = async (
    payload: WorkOrderOfflinePayload,
  ): Promise<OfflineApiResult<unknown>> => {
    if (!isOnline.value) {
      // Queue for later sync
      const operation = await offlineQueue.addToQueue('work_order_create', payload)

      toast.add({
        title: 'Work order saved offline',
        description: 'Your work order will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })

      return {
        success: true,
        isOffline: true,
        queuedOperationId: operation.id,
        data: {
          id: operation.id,
          ...payload,
          workOrderNumber: 'PENDING',
          status: 'draft',
          createdAt: operation.queuedAt,
        },
      }
    }

    try {
      const response = await $fetch('/api/work-orders', {
        method: 'POST',
        body: payload,
      })

      return {
        success: true,
        isOffline: false,
        data: response,
      }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to create work order'

      return {
        success: false,
        isOffline: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Update a work order with offline support
   */
  const updateWorkOrder = async (
    workOrderId: string,
    payload: Partial<WorkOrderOfflinePayload>,
    currentVersion?: string,
  ): Promise<OfflineApiResult<unknown>> => {
    if (!isOnline.value) {
      // Queue for later sync
      const operation = await offlineQueue.addToQueue(
        'work_order_update',
        payload as WorkOrderOfflinePayload,
        {
          entityId: workOrderId,
          entityVersion: currentVersion,
        },
      )

      toast.add({
        title: 'Changes saved offline',
        description: 'Your changes will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })

      return {
        success: true,
        isOffline: true,
        queuedOperationId: operation.id,
        data: {
          id: workOrderId,
          ...payload,
          updatedAt: operation.queuedAt,
        },
      }
    }

    try {
      const response = await $fetch(`/api/work-orders/${workOrderId}` as '/api/work-orders/:id', {
        method: 'PUT',
        body: payload,
      })

      return {
        success: true,
        isOffline: false,
        data: response,
      }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to update work order'

      return {
        success: false,
        isOffline: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Start an inspection with offline support
   */
  const startInspection = async (
    payload: InspectionStartOfflinePayload,
  ): Promise<OfflineApiResult<unknown>> => {
    if (!isOnline.value) {
      // Queue for later sync
      const operation = await offlineQueue.addToQueue('inspection_start', payload)

      toast.add({
        title: 'Inspection started offline',
        description: 'Your inspection will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })

      return {
        success: true,
        isOffline: true,
        queuedOperationId: operation.id,
        data: {
          id: operation.id,
          assetId: payload.assetId,
          status: 'in_progress',
          startedAt: operation.queuedAt,
          syncStatus: 'pending',
        },
      }
    }

    try {
      const response = await $fetch('/api/inspections/start', {
        method: 'POST',
        body: payload,
      })

      return {
        success: true,
        isOffline: false,
        data: response,
      }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to start inspection'

      return {
        success: false,
        isOffline: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Submit inspection items with offline support
   */
  const submitInspectionItems = async (
    inspectionId: string,
    payload: Omit<InspectionSubmitOfflinePayload, 'inspectionId'>,
  ): Promise<OfflineApiResult<unknown>> => {
    if (!isOnline.value) {
      // Queue for later sync
      const operation = await offlineQueue.addToQueue('inspection_submit', {
        inspectionId,
        ...payload,
      })

      toast.add({
        title: 'Inspection saved offline',
        description: 'Your inspection results will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })

      return {
        success: true,
        isOffline: true,
        queuedOperationId: operation.id,
        data: {
          id: inspectionId,
          items: payload.items,
          status: payload.complete ? 'completed' : 'in_progress',
          syncStatus: 'pending',
        },
      }
    }

    try {
      const response = await $fetch(`/api/inspections/${inspectionId}/items`, {
        method: 'POST',
        body: payload,
      })

      return {
        success: true,
        isOffline: false,
        data: response,
      }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to submit inspection'

      return {
        success: false,
        isOffline: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Create a fuel entry with offline support
   */
  const createFuelEntry = async (
    payload: FuelEntryOfflinePayload,
  ): Promise<OfflineApiResult<unknown>> => {
    if (!isOnline.value) {
      // Queue for later sync
      const operation = await offlineQueue.addToQueue('fuel_entry_create', payload)

      toast.add({
        title: 'Fuel entry saved offline',
        description: 'Your fuel entry will sync when you are back online.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })

      return {
        success: true,
        isOffline: true,
        queuedOperationId: operation.id,
        data: {
          id: operation.id,
          ...payload,
          syncStatus: 'pending',
          createdAt: operation.queuedAt,
        },
      }
    }

    try {
      const response = await $fetch('/api/fuel/transactions', {
        method: 'POST',
        body: {
          ...payload,
          syncStatus: 'synced',
        },
      })

      return {
        success: true,
        isOffline: false,
        data: response,
      }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to create fuel entry'

      return {
        success: false,
        isOffline: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Manually trigger sync of pending operations
   */
  const syncNow = async () => {
    if (!isOnline.value) {
      toast.add({
        title: 'Offline',
        description: 'Cannot sync while offline.',
        color: 'warning',
        icon: 'i-lucide-wifi-off',
      })
      return { synced: 0, failed: 0, results: [] }
    }

    return syncPendingOperations()
  }

  // Auto-sync when coming back online
  watch(isOnline, async (online) => {
    if (online && offlineQueue.queueCount.value > 0) {
      // Small delay to ensure network is stable
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await syncPendingOperations()
    }
  })

  return {
    // State
    isOnline,
    queueCount: offlineQueue.queueCount,

    // Work orders
    createWorkOrder,
    updateWorkOrder,

    // Inspections
    startInspection,
    submitInspectionItems,

    // Fuel entries
    createFuelEntry,

    // Sync
    syncNow,

    // Queue access
    getQueuedItems: offlineQueue.getQueuedItems,
    getQueueSummary: offlineQueue.getQueueSummary,
  }
}
