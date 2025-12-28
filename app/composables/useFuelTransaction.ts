/**
 * Fuel Transaction Composable
 * Manages fuel transaction recording with offline support, GPS capture, and sync
 */

interface FuelTransactionPayload {
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

interface FuelTransaction {
  id: string
  organisationId: string
  assetId: string
  operatorSessionId: string | null
  userId: string
  quantity: string
  unitCost: string | null
  totalCost: string | null
  fuelType: 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other'
  odometer: string | null
  engineHours: string | null
  receiptPhotoPath: string | null
  latitude: string | null
  longitude: string | null
  locationName: string | null
  locationAddress: string | null
  vendor: string | null
  notes: string | null
  syncStatus: 'synced' | 'pending'
  transactionDate: string
  createdAt: string
  updatedAt: string
  asset?: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  user?: {
    id: string
    firstName: string
    lastName: string
  }
}

interface OfflineFuelTransaction {
  id: string
  payload: FuelTransactionPayload
  timestamp: string
  retries: number
}

interface GPSLocation {
  latitude: number
  longitude: number
  accuracy?: number
  locationName?: string
  locationAddress?: string
}

const OFFLINE_QUEUE_KEY = 'fleet2_fuel_transaction_queue'
const FUEL_TRANSACTIONS_CACHE_KEY = 'fleet2_fuel_transactions_cache'
const MAX_OFFLINE_TRANSACTIONS = 50
const MAX_CACHED_TRANSACTIONS = 100

export function useFuelTransaction() {
  const isOnline = useOnline()
  const toast = useToast()

  // State
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const isCapturingLocation = ref(false)
  const currentLocation = ref<GPSLocation | null>(null)
  const locationError = ref<string | null>(null)

  // Offline queue management
  const getOfflineQueue = (): OfflineFuelTransaction[] => {
    if (!import.meta.client) return []
    try {
      const queue = localStorage.getItem(OFFLINE_QUEUE_KEY)
      return queue ? JSON.parse(queue) : []
    } catch {
      return []
    }
  }

  const saveOfflineQueue = (queue: OfflineFuelTransaction[]) => {
    if (!import.meta.client) return
    try {
      // Limit queue size
      if (queue.length > MAX_OFFLINE_TRANSACTIONS) {
        queue = queue.slice(-MAX_OFFLINE_TRANSACTIONS)
      }
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } catch {
      console.error('Failed to save offline queue')
    }
  }

  const addToOfflineQueue = (payload: FuelTransactionPayload): string => {
    const queue = getOfflineQueue()
    const id = crypto.randomUUID()
    queue.push({
      id,
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

  const pendingCount = computed(() => getOfflineQueue().length)

  // Transaction cache for offline viewing
  const getCachedTransactions = (): FuelTransaction[] => {
    if (!import.meta.client) return []
    try {
      const cached = localStorage.getItem(FUEL_TRANSACTIONS_CACHE_KEY)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  }

  const saveCachedTransactions = (transactions: FuelTransaction[]) => {
    if (!import.meta.client) return
    try {
      // Limit cache size
      if (transactions.length > MAX_CACHED_TRANSACTIONS) {
        transactions = transactions.slice(0, MAX_CACHED_TRANSACTIONS)
      }
      localStorage.setItem(FUEL_TRANSACTIONS_CACHE_KEY, JSON.stringify(transactions))
    } catch {
      console.error('Failed to save transactions cache')
    }
  }

  const cacheTransactions = (transactions: FuelTransaction[]) => {
    const existing = getCachedTransactions()
    const existingIds = new Set(existing.map((t) => t.id))

    // Merge new transactions, avoiding duplicates
    const merged = [...transactions.filter((t) => !existingIds.has(t.id)), ...existing]

    // Sort by transaction date, newest first
    merged.sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime(),
    )

    saveCachedTransactions(merged)
  }

  // GPS Location capture
  const captureLocation = async (): Promise<GPSLocation | null> => {
    if (!import.meta.client) return null
    if (!navigator.geolocation) {
      locationError.value = 'Geolocation is not supported by your browser'
      return null
    }

    isCapturingLocation.value = true
    locationError.value = null

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: GPSLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }

          // Try to reverse geocode for location name
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
              {
                headers: {
                  'User-Agent': 'Fleet2-App',
                },
              },
            )
            const data = await response.json()
            if (data.display_name) {
              location.locationAddress = data.display_name
              location.locationName = data.display_name.split(',').slice(0, 3).join(',').trim()
            }
          } catch {
            // Ignore reverse geocoding errors - GPS coordinates are still valid
          }

          currentLocation.value = location
          isCapturingLocation.value = false
          resolve(location)
        },
        (error) => {
          isCapturingLocation.value = false
          switch (error.code) {
            case error.PERMISSION_DENIED:
              locationError.value = 'Location permission denied. Please enable location access.'
              break
            case error.POSITION_UNAVAILABLE:
              locationError.value = 'Location information is unavailable.'
              break
            case error.TIMEOUT:
              locationError.value = 'Location request timed out.'
              break
            default:
              locationError.value = 'An unknown error occurred getting location.'
              break
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      )
    })
  }

  // Record a fuel transaction
  const recordTransaction = async (
    payload: FuelTransactionPayload,
  ): Promise<{ success: boolean; transaction?: FuelTransaction; error?: string }> => {
    isLoading.value = true

    try {
      if (!isOnline.value) {
        // Queue for later sync
        const offlineId = addToOfflineQueue(payload)

        // Create an optimistic transaction for UI
        const optimisticTransaction: FuelTransaction = {
          id: offlineId,
          organisationId: '',
          assetId: payload.assetId,
          operatorSessionId: payload.operatorSessionId || null,
          userId: '',
          quantity: payload.quantity.toString(),
          unitCost: payload.unitCost?.toString() || null,
          totalCost: payload.totalCost?.toString() || null,
          fuelType: payload.fuelType,
          odometer: payload.odometer?.toString() || null,
          engineHours: payload.engineHours?.toString() || null,
          receiptPhotoPath: payload.receiptPhotoPath || null,
          latitude: payload.latitude?.toString() || null,
          longitude: payload.longitude?.toString() || null,
          locationName: payload.locationName || null,
          locationAddress: payload.locationAddress || null,
          vendor: payload.vendor || null,
          notes: payload.notes || null,
          syncStatus: 'pending',
          transactionDate: payload.transactionDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        toast.add({
          title: 'Transaction saved offline',
          description: 'Your fuel transaction will sync when you are back online.',
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })

        return { success: true, transaction: optimisticTransaction }
      }

      const response = await $fetch<FuelTransaction>('/api/fuel/transactions', {
        method: 'POST',
        body: payload,
      })

      // Cache the new transaction
      cacheTransactions([response])

      return { success: true, transaction: response }
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string; message?: string } }
      const errorMessage =
        err.data?.statusMessage || err.data?.message || 'Failed to record fuel transaction'
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  // Sync offline queue
  const syncOfflineQueue = async (): Promise<{ synced: number; failed: number }> => {
    if (!isOnline.value) return { synced: 0, failed: 0 }

    const queue = getOfflineQueue()
    if (queue.length === 0) return { synced: 0, failed: 0 }

    isSyncing.value = true
    let synced = 0
    let failed = 0

    for (const item of queue) {
      try {
        await $fetch('/api/fuel/transactions', {
          method: 'POST',
          body: item.payload,
        })

        removeFromOfflineQueue(item.id)
        synced++
      } catch (error) {
        console.error(`Failed to sync fuel transaction ${item.id}:`, error)
        failed++

        // Increment retry count
        const updatedQueue = getOfflineQueue()
        const idx = updatedQueue.findIndex((q) => q.id === item.id)
        if (idx >= 0 && updatedQueue[idx]) {
          updatedQueue[idx]!.retries++
          // Remove if too many retries
          if (updatedQueue[idx]!.retries > 5) {
            updatedQueue.splice(idx, 1)
            toast.add({
              title: 'Transaction sync failed',
              description: 'A fuel transaction could not be synced after multiple attempts.',
              color: 'error',
              icon: 'i-lucide-alert-circle',
            })
          }
          saveOfflineQueue(updatedQueue)
        }
      }
    }

    isSyncing.value = false

    if (synced > 0) {
      toast.add({
        title: 'Transactions synced',
        description: `${synced} fuel transaction${synced > 1 ? 's' : ''} synced successfully.`,
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    }

    return { synced, failed }
  }

  // Fetch transactions with caching
  const fetchTransactions = async (params?: {
    assetId?: string
    limit?: number
    offset?: number
  }): Promise<{ data: FuelTransaction[]; total: number }> => {
    try {
      if (!isOnline.value) {
        // Return cached transactions when offline
        const cached = getCachedTransactions()
        let filtered = cached
        if (params?.assetId) {
          filtered = cached.filter((t) => t.assetId === params.assetId)
        }
        return {
          data: filtered.slice(params?.offset || 0, (params?.offset || 0) + (params?.limit || 50)),
          total: filtered.length,
        }
      }

      const query = new URLSearchParams()
      if (params?.assetId) query.set('assetId', params.assetId)
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())

      const response = await $fetch<{
        data: FuelTransaction[]
        pagination: { total: number }
      }>(`/api/fuel/transactions?${query.toString()}`)

      // Cache the fetched transactions
      cacheTransactions(response.data)

      return { data: response.data, total: response.pagination.total }
    } catch (error) {
      console.error('Failed to fetch fuel transactions:', error)
      // Return cached data on error
      const cached = getCachedTransactions()
      return { data: cached, total: cached.length }
    }
  }

  // Fetch fuel summary for an asset
  const fetchAssetFuelSummary = async (
    assetId: string,
  ): Promise<{
    totalQuantity: number
    totalCost: number
    avgCostPerLitre: number
    transactionCount: number
    avgFuelEfficiency: number | null
  } | null> => {
    try {
      const response = await $fetch<{
        summary: {
          totalQuantity: number
          totalCost: number
          avgUnitCost: number
          transactionCount: number
        }
        efficiency: {
          avgKmPerLitre: number | null
        }
      }>(`/api/assets/${assetId}/fuel-history?limit=0`)

      return {
        totalQuantity: response.summary.totalQuantity,
        totalCost: response.summary.totalCost,
        avgCostPerLitre: response.summary.avgUnitCost,
        transactionCount: response.summary.transactionCount,
        avgFuelEfficiency: response.efficiency.avgKmPerLitre,
      }
    } catch (error) {
      console.error('Failed to fetch asset fuel summary:', error)
      return null
    }
  }

  // Clear all cached data
  const clearCache = () => {
    if (!import.meta.client) return
    try {
      localStorage.removeItem(FUEL_TRANSACTIONS_CACHE_KEY)
    } catch {
      // Ignore
    }
  }

  // Watch for online status changes to trigger sync
  watch(isOnline, (online) => {
    if (online) {
      syncOfflineQueue()
    }
  })

  // Auto-sync on initial load if online
  if (import.meta.client && isOnline.value) {
    const queue = getOfflineQueue()
    if (queue.length > 0) {
      syncOfflineQueue()
    }
  }

  return {
    // State
    isLoading: readonly(isLoading),
    isSyncing: readonly(isSyncing),
    isCapturingLocation: readonly(isCapturingLocation),
    currentLocation: readonly(currentLocation),
    locationError: readonly(locationError),
    pendingCount,

    // Actions
    captureLocation,
    recordTransaction,
    syncOfflineQueue,
    fetchTransactions,
    fetchAssetFuelSummary,
    cacheTransactions,
    getCachedTransactions,
    clearCache,
  }
}
