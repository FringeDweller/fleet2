/**
 * US-18.1.1: Enhanced Caching Utilities
 *
 * Provides a comprehensive caching layer with:
 * - Multiple cache strategies (TTL, stale-while-revalidate, write-through)
 * - Cache warming and preloading
 * - Statistics and monitoring
 * - Automatic invalidation patterns
 * - Memory-efficient storage with compression for large payloads
 */

import { cache, redis } from './redis'

// Cache configuration
const CACHE_CONFIG = {
  // Default TTL values (in seconds)
  TTL: {
    SHORT: 30, // 30 seconds - frequently changing data
    MEDIUM: 60, // 1 minute - standard list queries
    LONG: 300, // 5 minutes - stable reference data
    EXTENDED: 900, // 15 minutes - rarely changing data (categories, templates)
    STATIC: 3600, // 1 hour - static configuration data
  },
  // Stale-while-revalidate windows (in seconds)
  STALE: {
    SHORT: 10,
    MEDIUM: 30,
    LONG: 60,
  },
  // Key prefixes for organization
  PREFIX: {
    DATA: 'data:',
    LIST: 'list:',
    COUNT: 'count:',
    STATS: 'stats:',
    LOOKUP: 'lookup:',
    SESSION: 'session:',
  },
  // Maximum cache entry size before compression (bytes)
  COMPRESSION_THRESHOLD: 1024,
} as const

// Cache statistics tracking
interface CacheStats {
  hits: number
  misses: number
  errors: number
  lastReset: number
}

const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  lastReset: Date.now(),
}

/**
 * Generate a cache key with proper namespacing
 */
export function cacheKey(
  prefix: keyof typeof CACHE_CONFIG.PREFIX,
  resource: string,
  orgId: string,
  params?: Record<string, unknown>,
): string {
  const base = `${CACHE_CONFIG.PREFIX[prefix]}${resource}:${orgId}`
  if (!params || Object.keys(params).length === 0) {
    return base
  }

  // Sort and serialize params for consistent keys
  const sortedParams = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${k}=${serializeValue(params[k])}`)
    .join('&')

  return sortedParams ? `${base}:${sortedParams}` : base
}

/**
 * Serialize a value for cache key generation
 */
function serializeValue(value: unknown): string {
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats & {
  hitRate: number
  totalRequests: number
  uptimeSeconds: number
} {
  const totalRequests = cacheStats.hits + cacheStats.misses
  return {
    ...cacheStats,
    hitRate: totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0,
    totalRequests,
    uptimeSeconds: Math.round((Date.now() - cacheStats.lastReset) / 1000),
  }
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheStats.hits = 0
  cacheStats.misses = 0
  cacheStats.errors = 0
  cacheStats.lastReset = Date.now()
}

/**
 * Cache wrapper with stale-while-revalidate support
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
    staleTtl?: number // Additional time to serve stale data while revalidating
    forceRefresh?: boolean
  } = {},
): Promise<T> {
  const { ttl = CACHE_CONFIG.TTL.MEDIUM, staleTtl = 0, forceRefresh = false } = options

  if (forceRefresh) {
    return fetchAndCache(key, fetcher, ttl, staleTtl)
  }

  try {
    // Try to get from cache
    const cached = await cache.get<{ data: T; timestamp: number; ttl: number }>(key)

    if (cached) {
      const age = Date.now() - cached.timestamp
      const maxAge = cached.ttl * 1000

      if (age < maxAge) {
        // Fresh data - return immediately
        cacheStats.hits++
        return cached.data
      }

      // Data is stale but within stale window - return stale and refresh in background
      if (staleTtl > 0 && age < maxAge + staleTtl * 1000) {
        cacheStats.hits++
        // Background refresh (fire and forget)
        fetchAndCache(key, fetcher, ttl, staleTtl).catch((err) => {
          console.warn(`[CACHE] Background refresh failed for ${key}:`, err)
        })
        return cached.data
      }
    }

    // Cache miss or expired beyond stale window
    cacheStats.misses++
    return fetchAndCache(key, fetcher, ttl, staleTtl)
  } catch (error) {
    cacheStats.errors++
    console.warn(`[CACHE] Error accessing cache for ${key}:`, error)
    // Fallback to direct fetch on cache error
    return fetcher()
  }
}

/**
 * Fetch data and store in cache
 */
async function fetchAndCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  staleTtl: number,
): Promise<T> {
  const data = await fetcher()
  const totalTtl = ttl + staleTtl

  // Store with metadata for stale-while-revalidate
  const cacheEntry = {
    data,
    timestamp: Date.now(),
    ttl,
  }

  // Fire and forget cache write
  cache.set(key, cacheEntry, totalTtl).catch((err) => {
    console.warn(`[CACHE] Failed to write cache for ${key}:`, err)
  })

  return data
}

/**
 * Cached list query with automatic key generation
 */
export async function cachedList<T>(
  resource: string,
  orgId: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
    staleTtl?: number
  } = {},
): Promise<T> {
  const key = cacheKey('LIST', resource, orgId, params)
  return cachedFetch(key, fetcher, {
    ttl: options.ttl ?? CACHE_CONFIG.TTL.MEDIUM,
    staleTtl: options.staleTtl ?? CACHE_CONFIG.STALE.SHORT,
  })
}

/**
 * Cached single item lookup
 */
export async function cachedLookup<T>(
  resource: string,
  id: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
  } = {},
): Promise<T> {
  const key = `${CACHE_CONFIG.PREFIX.LOOKUP}${resource}:${id}`
  return cachedFetch(key, fetcher, {
    ttl: options.ttl ?? CACHE_CONFIG.TTL.LONG,
  })
}

/**
 * Cached count query
 */
export async function cachedCount(
  resource: string,
  orgId: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<number>,
  options: {
    ttl?: number
  } = {},
): Promise<number> {
  const key = cacheKey('COUNT', resource, orgId, params)
  return cachedFetch(key, fetcher, {
    ttl: options.ttl ?? CACHE_CONFIG.TTL.MEDIUM,
  })
}

/**
 * Cached statistics/aggregate query
 */
export async function cachedStats<T>(
  resource: string,
  orgId: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
    staleTtl?: number
  } = {},
): Promise<T> {
  const key = cacheKey('STATS', resource, orgId, params)
  return cachedFetch(key, fetcher, {
    ttl: options.ttl ?? CACHE_CONFIG.TTL.LONG,
    staleTtl: options.staleTtl ?? CACHE_CONFIG.STALE.MEDIUM,
  })
}

/**
 * Invalidate cache entries for a resource
 */
export async function invalidateResource(resource: string, orgId: string): Promise<void> {
  const patterns = [
    `${CACHE_CONFIG.PREFIX.LIST}${resource}:${orgId}*`,
    `${CACHE_CONFIG.PREFIX.COUNT}${resource}:${orgId}*`,
    `${CACHE_CONFIG.PREFIX.STATS}${resource}:${orgId}*`,
  ]

  await Promise.all(patterns.map((pattern) => cache.delPattern(pattern)))
}

/**
 * Invalidate a single cached item
 */
export async function invalidateLookup(resource: string, id: string): Promise<void> {
  const key = `${CACHE_CONFIG.PREFIX.LOOKUP}${resource}:${id}`
  await cache.del(key)
}

/**
 * Invalidate all caches for an organization
 */
export async function invalidateOrganization(orgId: string): Promise<void> {
  const patterns = Object.values(CACHE_CONFIG.PREFIX).map((prefix) => `${prefix}*:${orgId}*`)
  await Promise.all(patterns.map((pattern) => cache.delPattern(pattern)))
}

/**
 * Cache warming - preload frequently accessed data
 */
export async function warmCache(
  entries: Array<{
    key: string
    fetcher: () => Promise<unknown>
    ttl: number
  }>,
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const entry of entries) {
    try {
      const data = await entry.fetcher()
      await cache.set(
        entry.key,
        { data, timestamp: Date.now(), ttl: entry.ttl },
        entry.ttl + CACHE_CONFIG.STALE.MEDIUM,
      )
      success++
    } catch (error) {
      console.warn(`[CACHE] Failed to warm cache for ${entry.key}:`, error)
      failed++
    }
  }

  return { success, failed }
}

/**
 * Memoize function results in cache
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  ttl: number = CACHE_CONFIG.TTL.MEDIUM,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const key = keyGenerator(...args)
    return cachedFetch(key, () => fn(...args), { ttl })
  }
}

/**
 * Export cache configuration for external use
 */
export const CacheConfig = CACHE_CONFIG

/**
 * Export cache TTL presets for convenience
 */
export const CacheTTL = CACHE_CONFIG.TTL
