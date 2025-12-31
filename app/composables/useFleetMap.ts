import { createSharedComposable } from '@vueuse/core'

export interface FleetPosition {
  assetId: string
  assetNumber: string
  assetName: string
  categoryId: string | null
  categoryName: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  latitude: number
  longitude: number
  locationName: string | null
  locationAddress: string | null
  lastLocationUpdate: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  mileage: string | null
  operationalHours: string | null
  imageUrl: string | null
}

export interface MapAsset {
  assetId: string
  assetNumber: string
  assetName: string
  categoryId: string | null
  categoryName: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  latitude: number | null
  longitude: number | null
  locationName: string | null
  locationAddress: string | null
  lastLocationUpdate: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  imageUrl: string | null
  hasLocation: boolean
}

export interface FleetStats {
  totalAssets: number
  assetsWithLocation: number
  activeAssets: number
  activeWithLocation: number
  displayedCount: number
}

export interface MapStats {
  total: number
  withLocation: number
  withoutLocation: number
  byStatus: {
    active: number
    inactive: number
    maintenance: number
    disposed: number
  }
}

export type RefreshInterval = 10000 | 30000 | 60000 | 300000 // 10s, 30s, 1min, 5min

const _useFleetMap = () => {
  // Filter state
  const filters = ref({
    status: 'all' as 'all' | 'active' | 'inactive' | 'maintenance' | 'disposed',
    categoryId: '' as string,
    search: '' as string,
    showInactiveAssets: true,
  })

  // Auto-refresh settings
  const autoRefresh = ref(true)
  const refreshInterval = ref<RefreshInterval>(30000) // 30 seconds default
  const lastRefresh = ref<Date | null>(null)

  // Selected asset for popup/details
  const selectedAssetId = ref<string | null>(null)

  // Build query params for live positions
  const liveQueryParams = computed(() => {
    const params: Record<string, string> = {}
    if (filters.value.status !== 'all') {
      params.status = filters.value.status
    }
    if (filters.value.categoryId) {
      params.categoryId = filters.value.categoryId
    }
    if (!filters.value.showInactiveAssets) {
      params.activeOnly = 'true'
    }
    return params
  })

  // Build query params for all assets (including those without location)
  const allAssetsQueryParams = computed(() => {
    const params: Record<string, string> = {}
    if (filters.value.status !== 'all') {
      params.status = filters.value.status
    }
    if (filters.value.categoryId) {
      params.categoryId = filters.value.categoryId
    }
    if (filters.value.search) {
      params.search = filters.value.search
    }
    return params
  })

  // Fetch live positions (assets with location data)
  const {
    data: livePositionsData,
    status: liveStatus,
    refresh: refreshLivePositions,
  } = useFetch<{
    positions: FleetPosition[]
    stats: FleetStats
  }>('/api/fleet/live-positions', {
    query: liveQueryParams,
    lazy: true,
    watch: [liveQueryParams],
  })

  // Fetch all assets for sidebar list
  const {
    data: allAssetsData,
    status: allAssetsStatus,
    refresh: refreshAllAssets,
  } = useFetch<{
    assets: MapAsset[]
    stats: MapStats
  }>('/api/fleet/map-assets', {
    query: allAssetsQueryParams,
    lazy: true,
    watch: [allAssetsQueryParams],
  })

  // Fetch categories for filter dropdown
  const { data: categories } = useFetch<{ id: string; name: string }[]>('/api/asset-categories', {
    lazy: true,
  })

  // Computed data
  const positions = computed(() => livePositionsData.value?.positions || [])
  const liveStats = computed(() => livePositionsData.value?.stats || null)
  const allAssets = computed(() => allAssetsData.value?.assets || [])
  const mapStats = computed(() => allAssetsData.value?.stats || null)

  // Filter assets in sidebar by search
  const filteredSidebarAssets = computed(() => {
    if (!filters.value.search) return allAssets.value
    const searchLower = filters.value.search.toLowerCase()
    return allAssets.value.filter(
      (asset: MapAsset) =>
        asset.assetNumber.toLowerCase().includes(searchLower) ||
        asset.assetName.toLowerCase().includes(searchLower) ||
        asset.licensePlate?.toLowerCase().includes(searchLower) ||
        asset.locationName?.toLowerCase().includes(searchLower),
    )
  })

  // Get selected asset details
  const selectedAsset = computed(() => {
    if (!selectedAssetId.value) return null
    // First check positions (has full location data)
    const position = positions.value.find((p: FleetPosition) => p.assetId === selectedAssetId.value)
    if (position) return position
    // Fallback to all assets
    return allAssets.value.find((a: MapAsset) => a.assetId === selectedAssetId.value) || null
  })

  // Map center calculation (average of all positions)
  const mapCenter = computed(() => {
    if (positions.value.length === 0) {
      // Default center (can be adjusted based on organisation location)
      return { lat: -27.4705, lng: 153.026 } // Brisbane, Australia
    }
    const sumLat = positions.value.reduce((sum: number, p: FleetPosition) => sum + p.latitude, 0)
    const sumLng = positions.value.reduce((sum: number, p: FleetPosition) => sum + p.longitude, 0)
    return {
      lat: sumLat / positions.value.length,
      lng: sumLng / positions.value.length,
    }
  })

  // Map bounds calculation
  const mapBounds = computed(() => {
    if (positions.value.length === 0) return null
    const lats = positions.value.map((p: FleetPosition) => p.latitude)
    const lngs = positions.value.map((p: FleetPosition) => p.longitude)
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    }
  })

  // Refresh all data
  const refresh = async () => {
    await Promise.all([refreshLivePositions(), refreshAllAssets()])
    lastRefresh.value = new Date()
  }

  // Auto-refresh interval
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null

  const startAutoRefresh = () => {
    stopAutoRefresh()
    if (autoRefresh.value) {
      refreshIntervalId = setInterval(() => {
        refresh()
      }, refreshInterval.value)
    }
  }

  const stopAutoRefresh = () => {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId)
      refreshIntervalId = null
    }
  }

  // Watch for auto-refresh changes
  watch(
    [autoRefresh, refreshInterval],
    () => {
      if (autoRefresh.value) {
        startAutoRefresh()
      } else {
        stopAutoRefresh()
      }
    },
    { immediate: true },
  )

  // Cleanup on unmount
  onUnmounted(() => {
    stopAutoRefresh()
  })

  // Select an asset
  const selectAsset = (assetId: string | null) => {
    selectedAssetId.value = assetId
  }

  // Clear filters
  const clearFilters = () => {
    filters.value = {
      status: 'all',
      categoryId: '',
      search: '',
      showInactiveAssets: true,
    }
  }

  // Get status color
  const getStatusColor = (status: MapAsset['status']) => {
    const colors = {
      active: 'success',
      inactive: 'neutral',
      maintenance: 'warning',
      disposed: 'error',
    } as const
    return colors[status] || 'neutral'
  }

  // Get status icon
  const getStatusIcon = (status: MapAsset['status']) => {
    const icons = {
      active: 'i-lucide-circle-check',
      inactive: 'i-lucide-circle-pause',
      maintenance: 'i-lucide-wrench',
      disposed: 'i-lucide-circle-x',
    } as const
    return icons[status] || 'i-lucide-circle'
  }

  // Format last update time
  const formatLastUpdate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return {
    // State
    filters,
    autoRefresh,
    refreshInterval,
    lastRefresh,
    selectedAssetId,

    // Data
    positions,
    liveStats,
    allAssets,
    mapStats,
    categories,
    filteredSidebarAssets,
    selectedAsset,

    // Computed
    mapCenter,
    mapBounds,

    // Status
    isLoading: computed(
      () => liveStatus.value === 'pending' || allAssetsStatus.value === 'pending',
    ),
    liveStatus,
    allAssetsStatus,

    // Actions
    refresh,
    selectAsset,
    clearFilters,
    startAutoRefresh,
    stopAutoRefresh,

    // Helpers
    getStatusColor,
    getStatusIcon,
    formatLastUpdate,
  }
}

export const useFleetMap = createSharedComposable(_useFleetMap)
