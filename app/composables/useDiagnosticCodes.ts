/**
 * Diagnostic Codes Composable (US-10.3, US-10.4)
 *
 * Manages reading and clearing DTCs from OBD-II devices with offline support.
 */

import type { ParsedDtc } from '~/services/obdCommands'

export interface DiagnosticCode {
  id: string
  code: string
  codeType: 'P' | 'C' | 'B' | 'U'
  description: string | null
  severity: 'info' | 'warning' | 'critical'
  rawResponse: string | null
  readAt: string
  clearedAt: string | null
  workOrderId: string | null
  syncStatus: 'synced' | 'pending' | 'failed'
  readByUser?: {
    id: string
    firstName: string
    lastName: string
  } | null
  clearedByUser?: {
    id: string
    firstName: string
    lastName: string
  } | null
  workOrder?: {
    id: string
    workOrderNumber: string
    status: string
  } | null
}

export interface ReadDtcsResponse {
  success: boolean
  codes: DiagnosticCode[]
  asset: { id: string; assetNumber: string }
  message?: string
}

export interface ClearDtcsResponse {
  success: boolean
  clearedCount: number
  message: string
}

export interface DtcHistoryResponse {
  data: DiagnosticCode[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  summary: {
    totalCodes: number
    activeCodes: number
    clearedCodes: number
    criticalCount: number
    warningCount: number
    infoCount: number
  }
}

interface OfflineDtcOperation {
  id: string
  type: 'read' | 'clear'
  assetId: string
  payload: {
    codes?: ParsedDtc[]
    rawResponse?: string
    workOrderId?: string
  }
  timestamp: string
  retries: number
}

const OFFLINE_QUEUE_KEY = 'fleet2_dtc_offline_queue'
const DTC_CACHE_KEY_PREFIX = 'fleet2_dtc_cache_'

export function useDiagnosticCodes(assetId?: Ref<string | undefined> | string) {
  const isOnline = useOnline()
  const toast = useToast()

  // Get the asset ID value
  const getAssetId = (): string | undefined => {
    if (typeof assetId === 'string') return assetId
    if (assetId && 'value' in assetId) return assetId.value
    return undefined
  }

  // State
  const activeCodes = ref<DiagnosticCode[]>([])
  const isLoading = ref(false)
  const isReading = ref(false)
  const isClearing = ref(false)
  const isSyncing = ref(false)
  const lastReadAt = ref<Date | null>(null)

  // Offline queue management
  const getOfflineQueue = (): OfflineDtcOperation[] => {
    if (!import.meta.client) return []
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return queue ? JSON.parse(queue) : []
  }

  const saveOfflineQueue = (queue: OfflineDtcOperation[]) => {
    if (!import.meta.client) return
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  }

  const addToOfflineQueue = (
    operation: Omit<OfflineDtcOperation, 'id' | 'timestamp' | 'retries'>,
  ) => {
    const queue = getOfflineQueue()
    queue.push({
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      retries: 0,
    })
    saveOfflineQueue(queue)
  }

  const removeFromOfflineQueue = (id: string) => {
    const queue = getOfflineQueue()
    saveOfflineQueue(queue.filter((op) => op.id !== id))
  }

  // Cache management
  const getCacheKey = () => `${DTC_CACHE_KEY_PREFIX}${getAssetId()}`

  const cacheActiveCodes = (codes: DiagnosticCode[]) => {
    if (!import.meta.client || !getAssetId()) return
    localStorage.setItem(
      getCacheKey(),
      JSON.stringify({
        codes,
        timestamp: new Date().toISOString(),
      }),
    )
  }

  const getCachedCodes = (): { codes: DiagnosticCode[]; timestamp: string } | null => {
    if (!import.meta.client || !getAssetId()) return null
    const cached = localStorage.getItem(getCacheKey())
    return cached ? JSON.parse(cached) : null
  }

  /**
   * Read DTCs from the OBD device and store in database
   */
  const readDtcs = async (
    parsedCodes: ParsedDtc[],
    rawResponse?: string,
  ): Promise<{ success: boolean; codes: DiagnosticCode[]; error?: string }> => {
    const id = getAssetId()
    if (!id) {
      return { success: false, codes: [], error: 'No asset ID provided' }
    }

    isReading.value = true

    try {
      if (!isOnline.value) {
        // Queue for offline sync
        addToOfflineQueue({
          type: 'read',
          assetId: id,
          payload: { codes: parsedCodes, rawResponse },
        })

        // Create optimistic local codes
        const optimisticCodes: DiagnosticCode[] = parsedCodes.map((code) => ({
          id: crypto.randomUUID(),
          code: code.code,
          codeType: code.code.charAt(0) as 'P' | 'C' | 'B' | 'U',
          description: code.description,
          severity: code.severity,
          rawResponse: rawResponse ?? null,
          readAt: new Date().toISOString(),
          clearedAt: null,
          workOrderId: null,
          syncStatus: 'pending' as const,
        }))

        activeCodes.value = optimisticCodes
        cacheActiveCodes(optimisticCodes)
        lastReadAt.value = new Date()

        toast.add({
          title: 'DTCs read (offline)',
          description: `${parsedCodes.length} code(s) will sync when online.`,
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })

        return { success: true, codes: optimisticCodes }
      }

      // Online: Send to API
      const response = await $fetch<ReadDtcsResponse>('/api/obd/dtc/read', {
        method: 'POST',
        body: {
          assetId: id,
          codes: parsedCodes,
          rawResponse,
        },
      })

      activeCodes.value = response.codes
      cacheActiveCodes(response.codes)
      lastReadAt.value = new Date()

      return { success: true, codes: response.codes }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string } }
      const errorMessage = err.data?.statusMessage || 'Failed to read DTCs'
      return { success: false, codes: [], error: errorMessage }
    } finally {
      isReading.value = false
    }
  }

  /**
   * Clear DTCs with required work order reference
   */
  const clearDtcs = async (
    workOrderId: string,
  ): Promise<{ success: boolean; clearedCount: number; error?: string }> => {
    const id = getAssetId()
    if (!id) {
      return { success: false, clearedCount: 0, error: 'No asset ID provided' }
    }

    if (!workOrderId) {
      return { success: false, clearedCount: 0, error: 'Work order reference required' }
    }

    isClearing.value = true

    try {
      if (!isOnline.value) {
        // Queue for offline sync
        addToOfflineQueue({
          type: 'clear',
          assetId: id,
          payload: { workOrderId },
        })

        const clearedCount = activeCodes.value.length
        activeCodes.value = []
        cacheActiveCodes([])

        toast.add({
          title: 'DTCs cleared (offline)',
          description: `Clear operation will sync when online.`,
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })

        return { success: true, clearedCount }
      }

      // Online: Send to API
      const response = await $fetch<ClearDtcsResponse>('/api/obd/dtc/clear', {
        method: 'POST',
        body: {
          assetId: id,
          workOrderId,
        },
      })

      activeCodes.value = []
      cacheActiveCodes([])

      return { success: true, clearedCount: response.clearedCount }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string } }
      const errorMessage = err.data?.statusMessage || 'Failed to clear DTCs'
      return { success: false, clearedCount: 0, error: errorMessage }
    } finally {
      isClearing.value = false
    }
  }

  /**
   * Fetch active (non-cleared) DTCs from server
   */
  const fetchActiveCodes = async (): Promise<void> => {
    const id = getAssetId()
    if (!id) return

    isLoading.value = true

    try {
      const response = await $fetch<ReadDtcsResponse>(`/api/obd/dtc/${id}/active`)
      activeCodes.value = response.codes
      cacheActiveCodes(response.codes)
    } catch (error) {
      console.error('Failed to fetch active codes:', error)
      // Try cache if offline
      if (!isOnline.value) {
        const cached = getCachedCodes()
        if (cached) {
          activeCodes.value = cached.codes
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch DTC history for the asset
   */
  const fetchHistory = async (
    options: { limit?: number; offset?: number; includeCleared?: boolean } = {},
  ): Promise<DtcHistoryResponse | null> => {
    const id = getAssetId()
    if (!id) return null

    try {
      const response = await $fetch<DtcHistoryResponse>(`/api/obd/dtc/${id}/history`, {
        query: {
          limit: options.limit ?? 50,
          offset: options.offset ?? 0,
          includeCleared: options.includeCleared ?? true,
        },
      })
      return response
    } catch (error) {
      console.error('Failed to fetch DTC history:', error)
      return null
    }
  }

  /**
   * Sync offline operations
   */
  const syncOfflineQueue = async (): Promise<void> => {
    if (!isOnline.value) return

    const queue = getOfflineQueue()
    if (queue.length === 0) return

    isSyncing.value = true

    for (const operation of queue) {
      try {
        if (operation.type === 'read' && operation.payload.codes) {
          await $fetch('/api/obd/dtc/read', {
            method: 'POST',
            body: {
              assetId: operation.assetId,
              codes: operation.payload.codes,
              rawResponse: operation.payload.rawResponse,
              offlineTimestamp: operation.timestamp,
            },
          })
        } else if (operation.type === 'clear' && operation.payload.workOrderId) {
          await $fetch('/api/obd/dtc/clear', {
            method: 'POST',
            body: {
              assetId: operation.assetId,
              workOrderId: operation.payload.workOrderId,
              offlineTimestamp: operation.timestamp,
            },
          })
        }

        removeFromOfflineQueue(operation.id)
      } catch (error) {
        console.error(`Failed to sync offline operation ${operation.id}:`, error)
        // Update retry count
        const updatedQueue = getOfflineQueue()
        const idx = updatedQueue.findIndex((op) => op.id === operation.id)
        if (idx >= 0 && updatedQueue[idx]) {
          updatedQueue[idx]!.retries++
          saveOfflineQueue(updatedQueue)
        }
      }
    }

    isSyncing.value = false

    // Refresh active codes after sync
    await fetchActiveCodes()
  }

  // Watch for online status to trigger sync
  watch(isOnline, (online) => {
    if (online) {
      syncOfflineQueue()
    }
  })

  // Initialize from cache if offline
  if (import.meta.client && getAssetId()) {
    const cached = getCachedCodes()
    if (cached) {
      activeCodes.value = cached.codes
      lastReadAt.value = new Date(cached.timestamp)
    }
  }

  return {
    // State
    activeCodes: readonly(activeCodes),
    isLoading: readonly(isLoading),
    isReading: readonly(isReading),
    isClearing: readonly(isClearing),
    isSyncing: readonly(isSyncing),
    lastReadAt: readonly(lastReadAt),
    hasCriticalCodes: computed(() =>
      activeCodes.value.some((code) => code.severity === 'critical'),
    ),
    hasWarningCodes: computed(() => activeCodes.value.some((code) => code.severity === 'warning')),
    pendingOfflineOperations: computed(() => getOfflineQueue().length),

    // Actions
    readDtcs,
    clearDtcs,
    fetchActiveCodes,
    fetchHistory,
    syncOfflineQueue,
  }
}
