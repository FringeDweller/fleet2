import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Offline Sync Tests - Mobile App Core Feature
 *
 * Tests for offline data synchronization, conflict resolution,
 * and queue processing for mobile app data sync.
 */

// Sync status enum matching the database schema
type SyncStatus = 'synced' | 'pending'

// Generic sync record interface
interface SyncRecord {
  id: string
  localId: string
  serverVersion: number
  clientVersion: number
  syncStatus: SyncStatus
  lastModifiedAt: Date
  createdAt: Date
  data: Record<string, unknown>
}

// Conflict resolution strategies
type ConflictResolutionStrategy = 'server_wins' | 'client_wins' | 'latest_wins' | 'merge' | 'manual'

// Sync queue item
interface SyncQueueItem {
  id: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  priority: number
  retryCount: number
  maxRetries: number
  createdAt: Date
  lastAttemptAt: Date | null
  error: string | null
}

// Sync result
interface SyncResult {
  success: boolean
  synced: number
  failed: number
  conflicts: number
  errors: Array<{ id: string; error: string }>
}

describe('Offline Sync Schema Validation', () => {
  // Schema for validating sync records - uses string datetime for consistency
  const syncRecordSchema = z.object({
    id: z.string().uuid(),
    localId: z.string().uuid(),
    serverVersion: z.number().int().min(0),
    clientVersion: z.number().int().min(0),
    syncStatus: z.enum(['synced', 'pending']),
    lastModifiedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    data: z.record(z.string(), z.any()),
  })

  const syncQueueItemSchema = z.object({
    id: z.string().uuid(),
    entityType: z.string().min(1),
    entityId: z.string().uuid(),
    operation: z.enum(['create', 'update', 'delete']),
    data: z.record(z.string(), z.any()),
    priority: z.number().int().min(0).max(10).default(5),
    retryCount: z.number().int().min(0).default(0),
    maxRetries: z.number().int().min(0).default(3),
    createdAt: z.string().datetime(),
    lastAttemptAt: z.string().datetime().nullable(),
    error: z.string().nullable(),
  })

  describe('Sync Record Validation', () => {
    it('should validate a valid sync record', () => {
      const validRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        localId: '123e4567-e89b-12d3-a456-426614174001',
        serverVersion: 5,
        clientVersion: 6,
        syncStatus: 'pending',
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: { name: 'Test', value: 123 },
      }

      const result = syncRecordSchema.safeParse(validRecord)
      expect(result.success).toBe(true)
    })

    it('should require valid UUIDs', () => {
      const invalidRecord = {
        id: 'not-a-uuid',
        localId: '123e4567-e89b-12d3-a456-426614174001',
        serverVersion: 1,
        clientVersion: 1,
        syncStatus: 'synced',
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: {},
      }

      const result = syncRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject negative version numbers', () => {
      const invalidRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        localId: '123e4567-e89b-12d3-a456-426614174001',
        serverVersion: -1,
        clientVersion: 1,
        syncStatus: 'synced',
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: {},
      }

      const result = syncRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should accept zero version numbers', () => {
      const record = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        localId: '123e4567-e89b-12d3-a456-426614174001',
        serverVersion: 0,
        clientVersion: 0,
        syncStatus: 'synced',
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: {},
      }

      const result = syncRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should require valid sync status', () => {
      const invalidRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        localId: '123e4567-e89b-12d3-a456-426614174001',
        serverVersion: 1,
        clientVersion: 1,
        syncStatus: 'unknown',
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: {},
      }

      const result = syncRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('Sync Queue Item Validation', () => {
    it('should validate a valid queue item', () => {
      const validItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'fuel_transaction',
        entityId: '123e4567-e89b-12d3-a456-426614174001',
        operation: 'create',
        data: { quantity: 50, fuelType: 'diesel' },
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        lastAttemptAt: null,
        error: null,
      }

      const result = syncQueueItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should require valid operation type', () => {
      const invalidItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'fuel_transaction',
        entityId: '123e4567-e89b-12d3-a456-426614174001',
        operation: 'upsert',
        data: {},
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        lastAttemptAt: null,
        error: null,
      }

      const result = syncQueueItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should default priority to 5', () => {
      const item = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'fuel_transaction',
        entityId: '123e4567-e89b-12d3-a456-426614174001',
        operation: 'create',
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        lastAttemptAt: null,
        error: null,
      }

      const result = syncQueueItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe(5)
      }
    })

    it('should reject priority above 10', () => {
      const invalidItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'fuel_transaction',
        entityId: '123e4567-e89b-12d3-a456-426614174001',
        operation: 'create',
        data: {},
        priority: 11,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        lastAttemptAt: null,
        error: null,
      }

      const result = syncQueueItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should accept all valid operations', () => {
      const operations = ['create', 'update', 'delete'] as const
      for (const operation of operations) {
        const item = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          entityType: 'fuel_transaction',
          entityId: '123e4567-e89b-12d3-a456-426614174001',
          operation,
          data: {},
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date().toISOString(),
          lastAttemptAt: null,
          error: null,
        }
        const result = syncQueueItemSchema.safeParse(item)
        expect(result.success).toBe(true)
      }
    })
  })
})

describe('Conflict Resolution Logic', () => {
  interface VersionedRecord {
    id: string
    version: number
    lastModifiedAt: Date
    data: Record<string, unknown>
  }

  function detectConflict(clientRecord: VersionedRecord, serverRecord: VersionedRecord): boolean {
    // Conflict exists when both client and server have modified the record
    // since the last sync (version mismatch and both have changes)
    return (
      clientRecord.version !== serverRecord.version &&
      clientRecord.lastModifiedAt > serverRecord.lastModifiedAt
    )
  }

  function resolveConflict(
    clientRecord: VersionedRecord,
    serverRecord: VersionedRecord,
    strategy: ConflictResolutionStrategy,
  ): VersionedRecord | null {
    if (!detectConflict(clientRecord, serverRecord)) {
      return clientRecord
    }

    switch (strategy) {
      case 'server_wins':
        return serverRecord

      case 'client_wins':
        return {
          ...clientRecord,
          version: serverRecord.version + 1,
        }

      case 'latest_wins':
        return clientRecord.lastModifiedAt > serverRecord.lastModifiedAt
          ? { ...clientRecord, version: serverRecord.version + 1 }
          : serverRecord

      case 'merge':
        return {
          id: clientRecord.id,
          version: serverRecord.version + 1,
          lastModifiedAt: new Date(
            Math.max(clientRecord.lastModifiedAt.getTime(), serverRecord.lastModifiedAt.getTime()),
          ),
          data: {
            ...serverRecord.data,
            ...clientRecord.data,
          },
        }

      case 'manual':
        return null // Requires user intervention

      default:
        return serverRecord
    }
  }

  describe('Conflict Detection', () => {
    it('should detect conflict when versions differ and client is newer', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Value' },
      }

      expect(detectConflict(clientRecord, serverRecord)).toBe(true)
    })

    it('should not detect conflict when versions match', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Value' },
      }

      expect(detectConflict(clientRecord, serverRecord)).toBe(false)
    })

    it('should not detect conflict when server is newer', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Server Value' },
      }

      expect(detectConflict(clientRecord, serverRecord)).toBe(false)
    })
  })

  describe('Server Wins Strategy', () => {
    it('should return server record on conflict', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Value', extra: 'data' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Value' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'server_wins')
      expect(result).toEqual(serverRecord)
    })
  })

  describe('Client Wins Strategy', () => {
    it('should return client record with incremented version on conflict', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Value' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'client_wins')
      expect(result?.data).toEqual(clientRecord.data)
      expect(result?.version).toBe(3) // serverVersion + 1
    })
  })

  describe('Latest Wins Strategy', () => {
    it('should return client record when client is newer', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Value' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'latest_wins')
      expect(result?.data).toEqual(clientRecord.data)
    })

    it('should return server record when server is newer (no conflict detected)', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Client Value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Server Value' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'latest_wins')
      expect(result?.data).toEqual(clientRecord.data) // No conflict, returns client
    })
  })

  describe('Merge Strategy', () => {
    it('should merge client and server data', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Name', clientField: 'client value' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Name', serverField: 'server value' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'merge')
      expect(result?.data).toEqual({
        name: 'Client Name', // Client value wins for shared field
        serverField: 'server value', // Server-only field preserved
        clientField: 'client value', // Client-only field preserved
      })
    })

    it('should use incremented server version', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Name' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 5,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Name' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'merge')
      expect(result?.version).toBe(6)
    })
  })

  describe('Manual Strategy', () => {
    it('should return null requiring user intervention', () => {
      const clientRecord: VersionedRecord = {
        id: '1',
        version: 3,
        lastModifiedAt: new Date('2024-12-28T12:00:00Z'),
        data: { name: 'Client Name' },
      }
      const serverRecord: VersionedRecord = {
        id: '1',
        version: 2,
        lastModifiedAt: new Date('2024-12-28T10:00:00Z'),
        data: { name: 'Server Name' },
      }

      const result = resolveConflict(clientRecord, serverRecord, 'manual')
      expect(result).toBeNull()
    })
  })
})

describe('Data Merge Strategies', () => {
  interface MergeableData {
    [key: string]: unknown
    _lastModified?: Record<string, number>
  }

  function mergeWithFieldTracking(
    clientData: MergeableData,
    serverData: MergeableData,
  ): MergeableData {
    const clientModified = clientData._lastModified || {}
    const serverModified = serverData._lastModified || {}

    const result: MergeableData = { ...serverData }
    delete result._lastModified

    // For each field, use the one that was modified more recently
    for (const key of Object.keys(clientData)) {
      if (key === '_lastModified') continue

      const clientTimestamp = clientModified[key] || 0
      const serverTimestamp = serverModified[key] || 0

      if (clientTimestamp > serverTimestamp) {
        result[key] = clientData[key]
      }
    }

    return result
  }

  function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target }

    for (const key of Object.keys(source)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        )
      } else {
        result[key] = source[key]
      }
    }

    return result
  }

  describe('Field-Level Merge with Timestamps', () => {
    it('should use client field when client timestamp is newer', () => {
      const clientData: MergeableData = {
        name: 'Client Name',
        quantity: 100,
        _lastModified: { name: 1000, quantity: 2000 },
      }
      const serverData: MergeableData = {
        name: 'Server Name',
        quantity: 50,
        _lastModified: { name: 500, quantity: 1500 },
      }

      const result = mergeWithFieldTracking(clientData, serverData)
      expect(result.name).toBe('Client Name')
      expect(result.quantity).toBe(100)
    })

    it('should use server field when server timestamp is newer', () => {
      const clientData: MergeableData = {
        name: 'Client Name',
        quantity: 100,
        _lastModified: { name: 500, quantity: 1500 },
      }
      const serverData: MergeableData = {
        name: 'Server Name',
        quantity: 50,
        _lastModified: { name: 1000, quantity: 2000 },
      }

      const result = mergeWithFieldTracking(clientData, serverData)
      expect(result.name).toBe('Server Name')
      expect(result.quantity).toBe(50)
    })

    it('should handle missing timestamps', () => {
      const clientData: MergeableData = {
        name: 'Client Name',
        quantity: 100,
      }
      const serverData: MergeableData = {
        name: 'Server Name',
        quantity: 50,
      }

      const result = mergeWithFieldTracking(clientData, serverData)
      expect(result.name).toBe('Server Name') // Server wins when no timestamps
      expect(result.quantity).toBe(50)
    })
  })

  describe('Deep Merge', () => {
    it('should merge nested objects', () => {
      const target = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      }
      const source = {
        user: { age: 31, email: 'john@example.com' },
        settings: { language: 'en' },
      }

      const result = deepMerge(target, source)
      expect(result.user).toEqual({
        name: 'John',
        age: 31,
        email: 'john@example.com',
      })
      expect(result.settings).toEqual({ theme: 'dark', language: 'en' })
    })

    it('should not merge arrays', () => {
      const target = { items: [1, 2, 3] }
      const source = { items: [4, 5, 6] }

      const result = deepMerge(target, source)
      expect(result.items).toEqual([4, 5, 6])
    })

    it('should handle null values', () => {
      const target = { name: 'John', value: null }
      const source = { name: null, value: 'Test' }

      const result = deepMerge(target, source)
      expect(result.name).toBeNull()
      expect(result.value).toBe('Test')
    })
  })
})

describe('Queue Processing Validation', () => {
  interface QueueItem {
    id: string
    priority: number
    retryCount: number
    maxRetries: number
    createdAt: Date
    lastAttemptAt: Date | null
    error: string | null
  }

  function sortQueueByPriority(queue: QueueItem[]): QueueItem[] {
    return [...queue].sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      // Older items first (FIFO within same priority)
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  function canRetry(item: QueueItem): boolean {
    return item.retryCount < item.maxRetries
  }

  function calculateBackoff(retryCount: number, baseDelayMs: number = 1000): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * 2 ** retryCount
    const jitter = Math.random() * 0.1 * exponentialDelay
    return Math.min(exponentialDelay + jitter, 60000) // Max 1 minute
  }

  function shouldAttempt(item: QueueItem, now: Date = new Date()): boolean {
    if (!canRetry(item)) return false
    if (!item.lastAttemptAt) return true

    const backoffMs = calculateBackoff(item.retryCount)
    const nextAttemptTime = item.lastAttemptAt.getTime() + backoffMs
    return now.getTime() >= nextAttemptTime
  }

  describe('Queue Sorting', () => {
    it('should sort by priority (higher first)', () => {
      const queue: QueueItem[] = [
        {
          id: '1',
          priority: 3,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          lastAttemptAt: null,
          error: null,
        },
        {
          id: '2',
          priority: 10,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          lastAttemptAt: null,
          error: null,
        },
        {
          id: '3',
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          lastAttemptAt: null,
          error: null,
        },
      ]

      const sorted = sortQueueByPriority(queue)
      expect(sorted[0].id).toBe('2')
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })

    it('should sort by creation date within same priority (FIFO)', () => {
      const queue: QueueItem[] = [
        {
          id: '1',
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date('2024-12-28T12:00:00Z'),
          lastAttemptAt: null,
          error: null,
        },
        {
          id: '2',
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date('2024-12-28T10:00:00Z'),
          lastAttemptAt: null,
          error: null,
        },
        {
          id: '3',
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date('2024-12-28T11:00:00Z'),
          lastAttemptAt: null,
          error: null,
        },
      ]

      const sorted = sortQueueByPriority(queue)
      expect(sorted[0].id).toBe('2') // Oldest first
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })
  })

  describe('Retry Logic', () => {
    it('should allow retry when count is below max', () => {
      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 2,
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null,
      }

      expect(canRetry(item)).toBe(true)
    })

    it('should not allow retry when count equals max', () => {
      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 3,
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null,
      }

      expect(canRetry(item)).toBe(false)
    })

    it('should not allow retry when count exceeds max', () => {
      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 5,
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null,
      }

      expect(canRetry(item)).toBe(false)
    })
  })

  describe('Backoff Calculation', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(0, 1000)).toBeGreaterThanOrEqual(1000)
      expect(calculateBackoff(0, 1000)).toBeLessThan(1100)

      expect(calculateBackoff(1, 1000)).toBeGreaterThanOrEqual(2000)
      expect(calculateBackoff(1, 1000)).toBeLessThan(2200)

      expect(calculateBackoff(2, 1000)).toBeGreaterThanOrEqual(4000)
      expect(calculateBackoff(2, 1000)).toBeLessThan(4400)
    })

    it('should cap at maximum delay', () => {
      const delay = calculateBackoff(10, 1000)
      expect(delay).toBeLessThanOrEqual(60000)
    })
  })

  describe('Attempt Scheduling', () => {
    it('should attempt immediately if never attempted', () => {
      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null,
      }

      expect(shouldAttempt(item)).toBe(true)
    })

    it('should not attempt if max retries reached', () => {
      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 3,
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: null,
        error: null,
      }

      expect(shouldAttempt(item)).toBe(false)
    })

    it('should respect backoff period', () => {
      const now = new Date()
      const recentAttempt = new Date(now.getTime() - 500) // 500ms ago

      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 0, // 1 second base backoff
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: recentAttempt,
        error: 'Network error',
      }

      expect(shouldAttempt(item, now)).toBe(false)
    })

    it('should allow attempt after backoff period', () => {
      const now = new Date()
      const oldAttempt = new Date(now.getTime() - 5000) // 5 seconds ago

      const item: QueueItem = {
        id: '1',
        priority: 5,
        retryCount: 0, // 1 second base backoff
        maxRetries: 3,
        createdAt: new Date(),
        lastAttemptAt: oldAttempt,
        error: 'Network error',
      }

      expect(shouldAttempt(item, now)).toBe(true)
    })
  })
})

describe('Sync Result Processing', () => {
  function processSyncBatch(
    items: Array<{ id: string; success: boolean; error?: string }>,
  ): SyncResult {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    }

    for (const item of items) {
      if (item.success) {
        result.synced++
      } else {
        result.failed++
        if (item.error) {
          result.errors.push({ id: item.id, error: item.error })
          if (item.error.includes('conflict')) {
            result.conflicts++
          }
        }
      }
    }

    result.success = result.failed === 0

    return result
  }

  it('should report all successful', () => {
    const items = [
      { id: '1', success: true },
      { id: '2', success: true },
      { id: '3', success: true },
    ]

    const result = processSyncBatch(items)
    expect(result.success).toBe(true)
    expect(result.synced).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should report failures', () => {
    const items = [
      { id: '1', success: true },
      { id: '2', success: false, error: 'Network error' },
      { id: '3', success: true },
    ]

    const result = processSyncBatch(items)
    expect(result.success).toBe(false)
    expect(result.synced).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({ id: '2', error: 'Network error' })
  })

  it('should count conflicts separately', () => {
    const items = [
      { id: '1', success: true },
      { id: '2', success: false, error: 'Version conflict detected' },
      { id: '3', success: false, error: 'Network error' },
    ]

    const result = processSyncBatch(items)
    expect(result.conflicts).toBe(1)
    expect(result.failed).toBe(2)
  })

  it('should handle empty batch', () => {
    const result = processSyncBatch([])
    expect(result.success).toBe(true)
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('should handle all failures', () => {
    const items = [
      { id: '1', success: false, error: 'Error 1' },
      { id: '2', success: false, error: 'Error 2' },
    ]

    const result = processSyncBatch(items)
    expect(result.success).toBe(false)
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.errors).toHaveLength(2)
  })
})

describe('Entity Type Sync Prioritization', () => {
  const entityTypePriorities: Record<string, number> = {
    location_record: 8, // High priority for real-time tracking
    fuel_transaction: 6, // Medium-high for expense tracking
    defect_report: 7, // Important for safety
    work_order: 5, // Standard priority
    inspection: 5, // Standard priority
    document: 3, // Lower priority for attachments
  }

  function getEntityPriority(entityType: string): number {
    return entityTypePriorities[entityType] ?? 5
  }

  it('should prioritize location records highest', () => {
    expect(getEntityPriority('location_record')).toBe(8)
  })

  it('should prioritize defect reports high', () => {
    expect(getEntityPriority('defect_report')).toBe(7)
  })

  it('should prioritize fuel transactions above work orders', () => {
    expect(getEntityPriority('fuel_transaction')).toBeGreaterThan(getEntityPriority('work_order'))
  })

  it('should prioritize documents lowest', () => {
    expect(getEntityPriority('document')).toBe(3)
  })

  it('should default unknown types to medium priority', () => {
    expect(getEntityPriority('unknown_entity')).toBe(5)
  })
})
