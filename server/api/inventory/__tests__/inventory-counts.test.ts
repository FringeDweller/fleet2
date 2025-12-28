import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Inventory Count Session Schema Validation Tests
 * Tests for inventory count sessions and items including variance calculation.
 */

// Count session status enum
const countSessionStatusSchema = z.enum(['in_progress', 'completed', 'cancelled'])

// Count item status enum
const countItemStatusSchema = z.enum(['pending', 'counted', 'approved', 'rejected'])

// Start count session schema
const startCountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  notes: z.string().optional(),
  partIds: z.array(z.string().uuid()).optional(),
})

// Update count item schema
const updateCountItemSchema = z.object({
  countedQuantity: z.number().nonnegative('Counted quantity must be non-negative'),
  notes: z.string().optional(),
})

// Approve count item schema
const approveCountItemSchema = z.object({
  adjustmentReason: z.string().min(1, 'Adjustment reason is required').optional(),
})

// Query count sessions schema
const queryCountSessionsSchema = z.object({
  status: countSessionStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

describe('Count Session Status Schema', () => {
  describe('Status Enum', () => {
    it('should accept valid status values', () => {
      const validStatuses = ['in_progress', 'completed', 'cancelled']
      for (const status of validStatuses) {
        const result = countSessionStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status values', () => {
      const invalidStatuses = ['pending', 'started', 'finished', 'paused']
      for (const status of invalidStatuses) {
        const result = countSessionStatusSchema.safeParse(status)
        expect(result.success).toBe(false)
      }
    })
  })
})

describe('Count Item Status Schema', () => {
  describe('Status Enum', () => {
    it('should accept valid status values', () => {
      const validStatuses = ['pending', 'counted', 'approved', 'rejected']
      for (const status of validStatuses) {
        const result = countItemStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status values', () => {
      const invalidStatuses = ['waiting', 'in_progress', 'completed', 'verified']
      for (const status of invalidStatuses) {
        const result = countItemStatusSchema.safeParse(status)
        expect(result.success).toBe(false)
      }
    })
  })
})

describe('Count Session Schema Validation', () => {
  describe('Start Count Session', () => {
    it('should validate minimal session (no name, all parts)', () => {
      const validSession = {}

      const result = startCountSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('should validate session with name', () => {
      const validSession = {
        name: 'Q4 2024 Full Inventory Count',
      }

      const result = startCountSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('should validate session with notes', () => {
      const validSession = {
        name: 'Monthly Count',
        notes: 'Focus on high-value items',
      }

      const result = startCountSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('should validate session with specific parts', () => {
      const validSession = {
        name: 'Partial Count',
        partIds: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
      }

      const result = startCountSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('should enforce name max length of 200', () => {
      const invalidSession = {
        name: 'a'.repeat(201),
      }

      const result = startCountSchema.safeParse(invalidSession)
      expect(result.success).toBe(false)
    })

    it('should require valid UUIDs for partIds', () => {
      const invalidSession = {
        partIds: ['invalid-uuid', 'another-invalid'],
      }

      const result = startCountSchema.safeParse(invalidSession)
      expect(result.success).toBe(false)
    })

    it('should allow empty partIds array', () => {
      const validSession = {
        partIds: [],
      }

      const result = startCountSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })
  })

  describe('Query Count Sessions', () => {
    it('should validate default query', () => {
      const query = {}

      const result = queryCountSessionsSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should validate query by status', () => {
      const query = {
        status: 'in_progress',
      }

      const result = queryCountSessionsSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate date range', () => {
      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      }

      const result = queryCountSessionsSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject invalid status', () => {
      const query = {
        status: 'invalid',
      }

      const result = queryCountSessionsSchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject invalid date format', () => {
      const query = {
        startDate: 'invalid-date',
      }

      const result = queryCountSessionsSchema.safeParse(query)
      expect(result.success).toBe(false)
    })
  })
})

describe('Count Item Schema Validation', () => {
  describe('Update Count Item', () => {
    it('should validate valid count', () => {
      const validUpdate = {
        countedQuantity: 50,
      }

      const result = updateCountItemSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should validate count with notes', () => {
      const validUpdate = {
        countedQuantity: 45,
        notes: 'Found 5 damaged items',
      }

      const result = updateCountItemSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow zero counted quantity', () => {
      const validUpdate = {
        countedQuantity: 0,
      }

      const result = updateCountItemSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should reject negative counted quantity', () => {
      const invalidUpdate = {
        countedQuantity: -5,
      }

      const result = updateCountItemSchema.safeParse(invalidUpdate)
      expect(result.success).toBe(false)
    })

    it('should allow decimal quantities', () => {
      const validUpdate = {
        countedQuantity: 25.5,
      }

      const result = updateCountItemSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should require countedQuantity', () => {
      const invalidUpdate = {
        notes: 'Missing quantity',
      }

      const result = updateCountItemSchema.safeParse(invalidUpdate)
      expect(result.success).toBe(false)
    })
  })

  describe('Approve Count Item', () => {
    it('should validate approval without reason', () => {
      const approval = {}

      const result = approveCountItemSchema.safeParse(approval)
      expect(result.success).toBe(true)
    })

    it('should validate approval with reason', () => {
      const approval = {
        adjustmentReason: 'Damaged items removed from inventory',
      }

      const result = approveCountItemSchema.safeParse(approval)
      expect(result.success).toBe(true)
    })

    it('should reject empty adjustment reason', () => {
      const approval = {
        adjustmentReason: '',
      }

      const result = approveCountItemSchema.safeParse(approval)
      expect(result.success).toBe(false)
    })
  })
})

describe('Variance Calculation', () => {
  describe('Basic Variance', () => {
    function calculateVariance(
      systemQuantity: number,
      countedQuantity: number,
    ): { variance: number; variancePercent: number } {
      const variance = countedQuantity - systemQuantity
      const variancePercent =
        systemQuantity === 0 ? (countedQuantity > 0 ? 100 : 0) : (variance / systemQuantity) * 100

      return {
        variance,
        variancePercent: Math.round(variancePercent * 100) / 100, // Round to 2 decimal places
      }
    }

    it('should calculate zero variance when equal', () => {
      const result = calculateVariance(50, 50)
      expect(result.variance).toBe(0)
      expect(result.variancePercent).toBe(0)
    })

    it('should calculate positive variance (found more)', () => {
      const result = calculateVariance(50, 55)
      expect(result.variance).toBe(5)
      expect(result.variancePercent).toBe(10)
    })

    it('should calculate negative variance (found less)', () => {
      const result = calculateVariance(50, 45)
      expect(result.variance).toBe(-5)
      expect(result.variancePercent).toBe(-10)
    })

    it('should handle zero system quantity', () => {
      const result = calculateVariance(0, 10)
      expect(result.variance).toBe(10)
      expect(result.variancePercent).toBe(100)
    })

    it('should handle zero counted and system quantity', () => {
      const result = calculateVariance(0, 0)
      expect(result.variance).toBe(0)
      expect(result.variancePercent).toBe(0)
    })

    it('should handle decimal quantities', () => {
      const result = calculateVariance(10.5, 10.0)
      expect(result.variance).toBeCloseTo(-0.5)
      expect(result.variancePercent).toBeCloseTo(-4.76, 1)
    })
  })

  describe('Variance Value Calculation', () => {
    function calculateVarianceValue(variance: number, unitCost: number | null): number {
      if (unitCost === null) return 0
      return variance * unitCost
    }

    it('should calculate positive variance value', () => {
      const result = calculateVarianceValue(5, 10.0)
      expect(result).toBe(50)
    })

    it('should calculate negative variance value', () => {
      const result = calculateVarianceValue(-5, 10.0)
      expect(result).toBe(-50)
    })

    it('should return zero for null unit cost', () => {
      const result = calculateVarianceValue(5, null)
      expect(result).toBe(0)
    })

    it('should return zero for zero variance', () => {
      const result = calculateVarianceValue(0, 10.0)
      expect(result).toBe(0)
    })
  })

  describe('Variance Threshold', () => {
    function isWithinThreshold(variancePercent: number, threshold: number): boolean {
      return Math.abs(variancePercent) <= threshold
    }

    it('should accept variance within threshold', () => {
      expect(isWithinThreshold(3, 5)).toBe(true)
    })

    it('should accept variance exactly at threshold', () => {
      expect(isWithinThreshold(5, 5)).toBe(true)
    })

    it('should reject variance above threshold', () => {
      expect(isWithinThreshold(6, 5)).toBe(false)
    })

    it('should handle negative variance', () => {
      expect(isWithinThreshold(-3, 5)).toBe(true)
      expect(isWithinThreshold(-6, 5)).toBe(false)
    })
  })
})

describe('Count Session Status Transitions', () => {
  describe('Valid Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    }

    function canTransition(fromStatus: string, toStatus: string): boolean {
      return validTransitions[fromStatus]?.includes(toStatus) ?? false
    }

    it('should allow in_progress to completed', () => {
      expect(canTransition('in_progress', 'completed')).toBe(true)
    })

    it('should allow in_progress to cancelled', () => {
      expect(canTransition('in_progress', 'cancelled')).toBe(true)
    })

    it('should not allow completed to any other status', () => {
      expect(canTransition('completed', 'in_progress')).toBe(false)
      expect(canTransition('completed', 'cancelled')).toBe(false)
    })

    it('should not allow cancelled to any other status', () => {
      expect(canTransition('cancelled', 'in_progress')).toBe(false)
      expect(canTransition('cancelled', 'completed')).toBe(false)
    })
  })

  describe('Completion Requirements', () => {
    interface CountItem {
      status: string
    }

    function canCompleteSession(items: CountItem[]): { canComplete: boolean; reason?: string } {
      if (items.length === 0) {
        return { canComplete: false, reason: 'No items in count session' }
      }

      const pendingCount = items.filter((i) => i.status === 'pending').length
      if (pendingCount > 0) {
        return {
          canComplete: false,
          reason: `${pendingCount} items still pending count`,
        }
      }

      const rejectedCount = items.filter((i) => i.status === 'rejected').length
      if (rejectedCount > 0) {
        return {
          canComplete: false,
          reason: `${rejectedCount} items rejected, must be recounted`,
        }
      }

      return { canComplete: true }
    }

    it('should allow completing when all items counted or approved', () => {
      const items = [{ status: 'counted' }, { status: 'approved' }, { status: 'counted' }]

      const result = canCompleteSession(items)
      expect(result.canComplete).toBe(true)
    })

    it('should prevent completing with pending items', () => {
      const items = [{ status: 'counted' }, { status: 'pending' }]

      const result = canCompleteSession(items)
      expect(result.canComplete).toBe(false)
      expect(result.reason).toContain('pending')
    })

    it('should prevent completing with rejected items', () => {
      const items = [{ status: 'counted' }, { status: 'rejected' }]

      const result = canCompleteSession(items)
      expect(result.canComplete).toBe(false)
      expect(result.reason).toContain('rejected')
    })

    it('should prevent completing empty session', () => {
      const result = canCompleteSession([])
      expect(result.canComplete).toBe(false)
      expect(result.reason).toBe('No items in count session')
    })
  })
})

describe('Count Item Status Transitions', () => {
  describe('Valid Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['counted'],
      counted: ['approved', 'rejected'],
      approved: [],
      rejected: ['counted'],
    }

    function canTransition(fromStatus: string, toStatus: string): boolean {
      return validTransitions[fromStatus]?.includes(toStatus) ?? false
    }

    it('should allow pending to counted', () => {
      expect(canTransition('pending', 'counted')).toBe(true)
    })

    it('should allow counted to approved', () => {
      expect(canTransition('counted', 'approved')).toBe(true)
    })

    it('should allow counted to rejected', () => {
      expect(canTransition('counted', 'rejected')).toBe(true)
    })

    it('should allow rejected to counted (recount)', () => {
      expect(canTransition('rejected', 'counted')).toBe(true)
    })

    it('should not allow approved to any other status', () => {
      expect(canTransition('approved', 'pending')).toBe(false)
      expect(canTransition('approved', 'counted')).toBe(false)
      expect(canTransition('approved', 'rejected')).toBe(false)
    })

    it('should not allow pending to approved directly', () => {
      expect(canTransition('pending', 'approved')).toBe(false)
    })

    it('should not allow pending to rejected directly', () => {
      expect(canTransition('pending', 'rejected')).toBe(false)
    })
  })
})

describe('Count Session Business Rules', () => {
  describe('Session Name Generation', () => {
    function generateSessionName(existingName?: string): string {
      if (existingName) return existingName
      const date = new Date().toISOString().split('T')[0]
      return `Inventory Count ${date}`
    }

    it('should use provided name', () => {
      expect(generateSessionName('Q4 Count')).toBe('Q4 Count')
    })

    it('should generate default name with date', () => {
      const name = generateSessionName()
      expect(name).toMatch(/^Inventory Count \d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Count Item Generation', () => {
    interface Part {
      id: string
      sku: string
      name: string
      quantityInStock: number
      location: string | null
    }

    interface CountItem {
      partId: string
      location: string | null
      systemQuantity: number
      status: 'pending'
    }

    function generateCountItems(parts: Part[]): CountItem[] {
      return parts.map((part) => ({
        partId: part.id,
        location: part.location,
        systemQuantity: part.quantityInStock,
        status: 'pending',
      }))
    }

    it('should generate count items for all parts', () => {
      const parts: Part[] = [
        { id: 'p1', sku: 'SKU-1', name: 'Part 1', quantityInStock: 10, location: 'A1' },
        { id: 'p2', sku: 'SKU-2', name: 'Part 2', quantityInStock: 20, location: 'B1' },
      ]

      const items = generateCountItems(parts)
      expect(items).toHaveLength(2)
      expect(items[0].partId).toBe('p1')
      expect(items[0].systemQuantity).toBe(10)
      expect(items[0].status).toBe('pending')
    })

    it('should handle parts with null location', () => {
      const parts: Part[] = [
        { id: 'p1', sku: 'SKU-1', name: 'Part 1', quantityInStock: 10, location: null },
      ]

      const items = generateCountItems(parts)
      expect(items[0].location).toBeNull()
    })

    it('should return empty array for no parts', () => {
      const items = generateCountItems([])
      expect(items).toHaveLength(0)
    })
  })

  describe('Stock Adjustment on Approval', () => {
    function calculateAdjustment(
      systemQuantity: number,
      countedQuantity: number,
    ): { adjustmentType: 'increase' | 'decrease' | 'none'; adjustmentAmount: number } {
      const difference = countedQuantity - systemQuantity

      if (difference === 0) {
        return { adjustmentType: 'none', adjustmentAmount: 0 }
      }

      return {
        adjustmentType: difference > 0 ? 'increase' : 'decrease',
        adjustmentAmount: Math.abs(difference),
      }
    }

    it('should calculate no adjustment when equal', () => {
      const result = calculateAdjustment(50, 50)
      expect(result.adjustmentType).toBe('none')
      expect(result.adjustmentAmount).toBe(0)
    })

    it('should calculate increase when counted more', () => {
      const result = calculateAdjustment(50, 55)
      expect(result.adjustmentType).toBe('increase')
      expect(result.adjustmentAmount).toBe(5)
    })

    it('should calculate decrease when counted less', () => {
      const result = calculateAdjustment(50, 45)
      expect(result.adjustmentType).toBe('decrease')
      expect(result.adjustmentAmount).toBe(5)
    })

    it('should handle decimal quantities', () => {
      const result = calculateAdjustment(10.5, 10.0)
      expect(result.adjustmentType).toBe('decrease')
      expect(result.adjustmentAmount).toBeCloseTo(0.5)
    })
  })

  describe('Session Summary', () => {
    interface CountItem {
      systemQuantity: number
      countedQuantity: number | null
      status: string
    }

    function calculateSessionSummary(items: CountItem[]): {
      totalItems: number
      pendingCount: number
      countedCount: number
      approvedCount: number
      rejectedCount: number
      totalVariance: number
      itemsWithVariance: number
    } {
      let pendingCount = 0
      let countedCount = 0
      let approvedCount = 0
      let rejectedCount = 0
      let totalVariance = 0
      let itemsWithVariance = 0

      for (const item of items) {
        switch (item.status) {
          case 'pending':
            pendingCount++
            break
          case 'counted':
            countedCount++
            break
          case 'approved':
            approvedCount++
            break
          case 'rejected':
            rejectedCount++
            break
        }

        if (item.countedQuantity !== null) {
          const variance = item.countedQuantity - item.systemQuantity
          totalVariance += variance
          if (variance !== 0) {
            itemsWithVariance++
          }
        }
      }

      return {
        totalItems: items.length,
        pendingCount,
        countedCount,
        approvedCount,
        rejectedCount,
        totalVariance,
        itemsWithVariance,
      }
    }

    it('should calculate summary for mixed status items', () => {
      const items: CountItem[] = [
        { systemQuantity: 10, countedQuantity: 10, status: 'approved' },
        { systemQuantity: 20, countedQuantity: 18, status: 'counted' },
        { systemQuantity: 15, countedQuantity: null, status: 'pending' },
        { systemQuantity: 30, countedQuantity: 25, status: 'rejected' },
      ]

      const summary = calculateSessionSummary(items)
      expect(summary.totalItems).toBe(4)
      expect(summary.pendingCount).toBe(1)
      expect(summary.countedCount).toBe(1)
      expect(summary.approvedCount).toBe(1)
      expect(summary.rejectedCount).toBe(1)
      expect(summary.totalVariance).toBe(-7) // (0) + (-2) + (-5) = -7
      expect(summary.itemsWithVariance).toBe(2) // Items with non-zero variance
    })

    it('should handle empty items', () => {
      const summary = calculateSessionSummary([])
      expect(summary.totalItems).toBe(0)
      expect(summary.pendingCount).toBe(0)
      expect(summary.totalVariance).toBe(0)
    })

    it('should handle all matching counts', () => {
      const items: CountItem[] = [
        { systemQuantity: 10, countedQuantity: 10, status: 'approved' },
        { systemQuantity: 20, countedQuantity: 20, status: 'approved' },
      ]

      const summary = calculateSessionSummary(items)
      expect(summary.totalVariance).toBe(0)
      expect(summary.itemsWithVariance).toBe(0)
    })
  })
})

describe('Concurrent Session Rules', () => {
  describe('Part Overlap Check', () => {
    interface CountSession {
      id: string
      status: string
      partIds: string[]
    }

    function checkPartOverlap(
      newPartIds: string[],
      activeSessions: CountSession[],
    ): { hasOverlap: boolean; overlappingParts: string[]; overlappingSessions: string[] } {
      const overlappingParts: string[] = []
      const overlappingSessions: Set<string> = new Set()

      for (const session of activeSessions) {
        if (session.status !== 'in_progress') continue

        for (const partId of newPartIds) {
          if (session.partIds.includes(partId)) {
            overlappingParts.push(partId)
            overlappingSessions.add(session.id)
          }
        }
      }

      return {
        hasOverlap: overlappingParts.length > 0,
        overlappingParts: [...new Set(overlappingParts)],
        overlappingSessions: [...overlappingSessions],
      }
    }

    it('should detect no overlap with empty sessions', () => {
      const result = checkPartOverlap(['p1', 'p2'], [])
      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingParts).toHaveLength(0)
    })

    it('should detect overlap with active session', () => {
      const activeSessions: CountSession[] = [
        { id: 's1', status: 'in_progress', partIds: ['p1', 'p3'] },
      ]

      const result = checkPartOverlap(['p1', 'p2'], activeSessions)
      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingParts).toContain('p1')
      expect(result.overlappingSessions).toContain('s1')
    })

    it('should ignore completed sessions', () => {
      const activeSessions: CountSession[] = [
        { id: 's1', status: 'completed', partIds: ['p1', 'p2'] },
      ]

      const result = checkPartOverlap(['p1', 'p2'], activeSessions)
      expect(result.hasOverlap).toBe(false)
    })

    it('should detect overlap across multiple sessions', () => {
      const activeSessions: CountSession[] = [
        { id: 's1', status: 'in_progress', partIds: ['p1'] },
        { id: 's2', status: 'in_progress', partIds: ['p2'] },
      ]

      const result = checkPartOverlap(['p1', 'p2', 'p3'], activeSessions)
      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingParts).toContain('p1')
      expect(result.overlappingParts).toContain('p2')
      expect(result.overlappingSessions).toContain('s1')
      expect(result.overlappingSessions).toContain('s2')
    })
  })
})
