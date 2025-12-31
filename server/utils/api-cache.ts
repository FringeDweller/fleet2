/**
 * US-18.1.1: API Response Caching
 * Provides caching utilities for frequently accessed API endpoints
 */

import { cache } from './redis'

// Cache key prefixes
const CACHE_PREFIX = {
  LIST: 'api:list:',
  SINGLE: 'api:single:',
  COUNT: 'api:count:',
  STATS: 'api:stats:',
} as const

// Default TTL values (in seconds)
const DEFAULT_TTL = {
  LIST: 60, // 1 minute for list queries
  SINGLE: 300, // 5 minutes for single item
  COUNT: 120, // 2 minutes for counts
  STATS: 180, // 3 minutes for statistics
} as const

/**
 * Generate a cache key from parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${k}=${String(params[k])}`)
    .join('&')
  return `${prefix}${sortedParams || 'default'}`
}

/**
 * Get cached data or fetch from source
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL.LIST,
): Promise<T> {
  // Try to get from cache first
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()

  // Cache the result (fire and forget to not delay response)
  cache.set(key, data, ttlSeconds).catch((err) => {
    console.warn(`[CACHE] Failed to set cache for key ${key}:`, err)
  })

  return data
}

/**
 * Invalidate cache entries matching a pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await cache.delPattern(pattern)
  } catch (err) {
    console.warn(`[CACHE] Failed to invalidate cache pattern ${pattern}:`, err)
  }
}

/**
 * Cache utilities for specific data types
 */
export const apiCache = {
  /**
   * Get/set list cache (e.g., /api/assets, /api/work-orders)
   */
  list: {
    key: (resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      generateCacheKey(`${CACHE_PREFIX.LIST}${resource}:${orgId}:`, params),

    get: <T>(resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      cache.get<T>(apiCache.list.key(resource, orgId, params)),

    set: <T>(
      resource: string,
      orgId: string,
      params: Record<string, unknown>,
      data: T,
      ttl = DEFAULT_TTL.LIST,
    ) => cache.set(apiCache.list.key(resource, orgId, params), data, ttl),

    invalidate: (resource: string, orgId: string) =>
      invalidateCache(`${CACHE_PREFIX.LIST}${resource}:${orgId}:*`),
  },

  /**
   * Get/set single item cache (e.g., /api/assets/:id)
   */
  single: {
    key: (resource: string, id: string) => `${CACHE_PREFIX.SINGLE}${resource}:${id}`,

    get: <T>(resource: string, id: string) => cache.get<T>(apiCache.single.key(resource, id)),

    set: <T>(resource: string, id: string, data: T, ttl = DEFAULT_TTL.SINGLE) =>
      cache.set(apiCache.single.key(resource, id), data, ttl),

    invalidate: (resource: string, id: string) => cache.del(apiCache.single.key(resource, id)),
  },

  /**
   * Get/set count cache (e.g., total counts for pagination)
   */
  count: {
    key: (resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      generateCacheKey(`${CACHE_PREFIX.COUNT}${resource}:${orgId}:`, params),

    get: (resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      cache.get<number>(apiCache.count.key(resource, orgId, params)),

    set: (
      resource: string,
      orgId: string,
      params: Record<string, unknown>,
      count: number,
      ttl = DEFAULT_TTL.COUNT,
    ) => cache.set(apiCache.count.key(resource, orgId, params), count, ttl),

    invalidate: (resource: string, orgId: string) =>
      invalidateCache(`${CACHE_PREFIX.COUNT}${resource}:${orgId}:*`),
  },

  /**
   * Get/set statistics cache (e.g., dashboard stats, reports)
   */
  stats: {
    key: (resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      generateCacheKey(`${CACHE_PREFIX.STATS}${resource}:${orgId}:`, params),

    get: <T>(resource: string, orgId: string, params: Record<string, unknown> = {}) =>
      cache.get<T>(apiCache.stats.key(resource, orgId, params)),

    set: <T>(
      resource: string,
      orgId: string,
      params: Record<string, unknown>,
      data: T,
      ttl = DEFAULT_TTL.STATS,
    ) => cache.set(apiCache.stats.key(resource, orgId, params), data, ttl),

    invalidate: (resource: string, orgId: string) =>
      invalidateCache(`${CACHE_PREFIX.STATS}${resource}:${orgId}:*`),
  },

  /**
   * Invalidate all caches for a resource
   */
  invalidateResource: async (resource: string, orgId: string): Promise<void> => {
    await Promise.all([
      apiCache.list.invalidate(resource, orgId),
      apiCache.count.invalidate(resource, orgId),
      apiCache.stats.invalidate(resource, orgId),
    ])
  },
}
