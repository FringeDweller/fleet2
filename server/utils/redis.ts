import Redis from 'ioredis'

const redisUrl = process.env.NUXT_REDIS_URL || 'redis://localhost:63791'

// Create Redis client with connection pooling
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
})

// Cache utility functions
export const cache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  },

  /**
   * Set a cached value with optional TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized)
    } else {
      await redis.set(key, serialized)
    }
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    await redis.del(key)
  },

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key)
    return result === 1
  },

  /**
   * Get TTL of a key (in seconds)
   */
  async ttl(key: string): Promise<number> {
    return await redis.ttl(key)
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return await redis.incr(key)
  },

  /**
   * Set expiration on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await redis.expire(key, ttlSeconds)
  },
}

// Session storage for Redis-based sessions
export const sessionStorage = {
  prefix: 'session:',

  async get(sessionId: string): Promise<Record<string, unknown> | null> {
    return cache.get<Record<string, unknown>>(`${this.prefix}${sessionId}`)
  },

  async set(sessionId: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    await cache.set(`${this.prefix}${sessionId}`, data, ttlSeconds)
  },

  async destroy(sessionId: string): Promise<void> {
    await cache.del(`${this.prefix}${sessionId}`)
  },

  async touch(sessionId: string, ttlSeconds: number): Promise<void> {
    await cache.expire(`${this.prefix}${sessionId}`, ttlSeconds)
  },
}
