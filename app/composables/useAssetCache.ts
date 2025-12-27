interface CachedAsset {
  id: string
  assetNumber: string
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  status: string
  categoryName: string | null
  cachedAt: number
}

interface AssetCache {
  version: number
  assets: Record<string, CachedAsset>
}

const CACHE_KEY = 'fleet-asset-cache'
const CACHE_VERSION = 1
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
const CACHE_MAX_ITEMS = 100

export function useAssetCache() {
  const isOnline = ref(true)

  // Track online status
  if (import.meta.client) {
    isOnline.value = navigator.onLine

    const updateOnlineStatus = () => {
      isOnline.value = navigator.onLine
    }

    onMounted(() => {
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)
    })

    onUnmounted(() => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    })
  }

  function getCache(): AssetCache {
    if (!import.meta.client) {
      return { version: CACHE_VERSION, assets: {} }
    }

    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) {
        return { version: CACHE_VERSION, assets: {} }
      }

      const parsed = JSON.parse(cached) as AssetCache
      if (parsed.version !== CACHE_VERSION) {
        // Clear cache on version mismatch
        localStorage.removeItem(CACHE_KEY)
        return { version: CACHE_VERSION, assets: {} }
      }

      return parsed
    } catch {
      return { version: CACHE_VERSION, assets: {} }
    }
  }

  function setCache(cache: AssetCache): void {
    if (!import.meta.client) return

    try {
      // Prune old entries if over limit
      const entries = Object.entries(cache.assets)
      if (entries.length > CACHE_MAX_ITEMS) {
        // Sort by cachedAt and keep newest
        entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt)
        cache.assets = Object.fromEntries(entries.slice(0, CACHE_MAX_ITEMS))
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
      // Storage full or unavailable, try to clear old items
      try {
        localStorage.removeItem(CACHE_KEY)
      } catch {
        // Ignore storage errors
      }
    }
  }

  function cacheAsset(asset: {
    id: string
    assetNumber: string
    vin?: string | null
    make?: string | null
    model?: string | null
    year?: number | null
    licensePlate?: string | null
    status?: string
    category?: { name: string } | null
  }): void {
    const cache = getCache()

    cache.assets[asset.id] = {
      id: asset.id,
      assetNumber: asset.assetNumber,
      vin: asset.vin ?? null,
      make: asset.make ?? null,
      model: asset.model ?? null,
      year: asset.year ?? null,
      licensePlate: asset.licensePlate ?? null,
      status: asset.status ?? 'active',
      categoryName: asset.category?.name ?? null,
      cachedAt: Date.now(),
    }

    setCache(cache)
  }

  function getCachedAsset(id: string): CachedAsset | null {
    const cache = getCache()
    const asset = cache.assets[id]

    if (!asset) return null

    // Check if expired
    if (Date.now() - asset.cachedAt > CACHE_MAX_AGE) {
      // Remove expired asset by creating new object without it
      const { [id]: _, ...remaining } = cache.assets
      cache.assets = remaining
      setCache(cache)
      return null
    }

    return asset
  }

  function getAllCachedAssets(): CachedAsset[] {
    const cache = getCache()
    const now = Date.now()

    return Object.values(cache.assets)
      .filter((asset) => now - asset.cachedAt <= CACHE_MAX_AGE)
      .sort((a, b) => b.cachedAt - a.cachedAt)
  }

  function searchCachedAssets(query: string): CachedAsset[] {
    const lowerQuery = query.toLowerCase()

    return getAllCachedAssets().filter((asset) => {
      return (
        asset.assetNumber.toLowerCase().includes(lowerQuery) ||
        asset.vin?.toLowerCase().includes(lowerQuery) ||
        asset.make?.toLowerCase().includes(lowerQuery) ||
        asset.model?.toLowerCase().includes(lowerQuery) ||
        asset.licensePlate?.toLowerCase().includes(lowerQuery)
      )
    })
  }

  function clearCache(): void {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(CACHE_KEY)
    } catch {
      // Ignore storage errors
    }
  }

  function getCacheStats(): { count: number; oldestAge: number | null } {
    const assets = getAllCachedAssets()
    const first = assets[0]
    if (!first) {
      return { count: 0, oldestAge: null }
    }

    const oldest = assets.reduce((min, a) => (a.cachedAt < min.cachedAt ? a : min), first)
    return {
      count: assets.length,
      oldestAge: Date.now() - oldest.cachedAt,
    }
  }

  return {
    isOnline: readonly(isOnline),
    cacheAsset,
    getCachedAsset,
    getAllCachedAssets,
    searchCachedAssets,
    clearCache,
    getCacheStats,
  }
}
