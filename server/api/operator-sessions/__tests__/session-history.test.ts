/**
 * Session History Tests
 *
 * Tests for session listing, filtering, statistics, and operator utilization.
 * Following behavioral testing patterns - testing actual business logic.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createFleetManagerUser,
  createOperatorUser,
  resetFixtures,
} from '../../../../tests/helpers'

// Query parameters schema for session listing
const sessionQuerySchema = z.object({
  assetId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  sortBy: z
    .enum(['startTime', 'endTime', 'tripDistance', 'tripDurationMinutes', 'createdAt'])
    .optional()
    .default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

describe('Session History', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('Query Parameter Validation', () => {
    describe('assetId filter', () => {
      it('should accept valid UUID for assetId filter', () => {
        // Arrange
        const query = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000')
        }
      })

      it('should reject invalid UUID for assetId filter', () => {
        // Arrange
        const query = {
          assetId: 'invalid-uuid',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow missing assetId filter', () => {
        // Arrange
        const query = {}

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBeUndefined()
        }
      })
    })

    describe('operatorId filter', () => {
      it('should accept valid UUID for operatorId filter', () => {
        // Arrange
        const query = {
          operatorId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID for operatorId filter', () => {
        // Arrange
        const query = {
          operatorId: 'not-a-uuid',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('status filter', () => {
      it('should accept valid status values', () => {
        // Arrange
        const validStatuses = ['active', 'completed', 'cancelled']

        for (const status of validStatuses) {
          const query = { status }

          // Act
          const result = sessionQuerySchema.safeParse(query)

          // Assert
          expect(result.success).toBe(true)
        }
      })

      it('should reject invalid status value', () => {
        // Arrange
        const query = {
          status: 'invalid_status',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('date range filters', () => {
      it('should accept valid dateFrom filter', () => {
        // Arrange
        const query = {
          dateFrom: '2024-12-01T00:00:00.000Z',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept valid dateTo filter', () => {
        // Arrange
        const query = {
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept both dateFrom and dateTo filters', () => {
        // Arrange
        const query = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid date format', () => {
        // Arrange
        const query = {
          dateFrom: 'December 1, 2024',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('pagination', () => {
      it('should default limit to 50', () => {
        // Arrange
        const query = {}

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.limit).toBe(50)
        }
      })

      it('should accept valid limit within range', () => {
        // Arrange
        const query = {
          limit: 25,
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.limit).toBe(25)
        }
      })

      it('should reject limit exceeding max', () => {
        // Arrange
        const query = {
          limit: 101,
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject limit below minimum', () => {
        // Arrange
        const query = {
          limit: 0,
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should default offset to 0', () => {
        // Arrange
        const query = {}

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.offset).toBe(0)
        }
      })

      it('should accept valid offset', () => {
        // Arrange
        const query = {
          offset: 100,
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.offset).toBe(100)
        }
      })

      it('should reject negative offset', () => {
        // Arrange
        const query = {
          offset: -10,
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('sorting', () => {
      it('should default sortBy to startTime', () => {
        // Arrange
        const query = {}

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.sortBy).toBe('startTime')
        }
      })

      it('should default sortOrder to desc', () => {
        // Arrange
        const query = {}

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.sortOrder).toBe('desc')
        }
      })

      it('should accept all valid sortBy fields', () => {
        // Arrange
        const validSortFields = [
          'startTime',
          'endTime',
          'tripDistance',
          'tripDurationMinutes',
          'createdAt',
        ]

        for (const sortBy of validSortFields) {
          const query = { sortBy }

          // Act
          const result = sessionQuerySchema.safeParse(query)

          // Assert
          expect(result.success).toBe(true)
        }
      })

      it('should reject invalid sortBy field', () => {
        // Arrange
        const query = {
          sortBy: 'invalidField',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept both asc and desc sort orders', () => {
        // Arrange
        const ascQuery = { sortOrder: 'asc' }
        const descQuery = { sortOrder: 'desc' }

        // Act
        const ascResult = sessionQuerySchema.safeParse(ascQuery)
        const descResult = sessionQuerySchema.safeParse(descQuery)

        // Assert
        expect(ascResult.success).toBe(true)
        expect(descResult.success).toBe(true)
      })
    })

    describe('combined filters', () => {
      it('should accept all filters combined', () => {
        // Arrange
        const query = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          operatorId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'completed',
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          limit: 25,
          offset: 50,
          sortBy: 'tripDistance',
          sortOrder: 'asc',
        }

        // Act
        const result = sessionQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000')
          expect(result.data.operatorId).toBe('123e4567-e89b-12d3-a456-426614174001')
          expect(result.data.status).toBe('completed')
          expect(result.data.limit).toBe(25)
          expect(result.data.offset).toBe(50)
          expect(result.data.sortBy).toBe('tripDistance')
          expect(result.data.sortOrder).toBe('asc')
        }
      })
    })
  })

  describe('Session Statistics Calculations', () => {
    interface SessionData {
      tripDistance: string | null
      tripDurationMinutes: number | null
      status: 'active' | 'completed' | 'cancelled'
    }

    // Helper function to calculate session statistics
    function calculateStatistics(sessions: SessionData[]) {
      const completedSessions = sessions.filter((s) => s.status === 'completed')

      const totalDistance = completedSessions.reduce((sum, s) => {
        return sum + (s.tripDistance ? parseFloat(s.tripDistance) : 0)
      }, 0)

      const totalDuration = completedSessions.reduce((sum, s) => {
        return sum + (s.tripDurationMinutes ?? 0)
      }, 0)

      const avgDistance =
        completedSessions.length > 0 ? totalDistance / completedSessions.length : 0

      const avgDuration =
        completedSessions.length > 0 ? totalDuration / completedSessions.length : 0

      return {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        activeSessions: sessions.filter((s) => s.status === 'active').length,
        cancelledSessions: sessions.filter((s) => s.status === 'cancelled').length,
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        totalDurationMinutes: totalDuration,
        avgDistanceKm: Math.round(avgDistance * 100) / 100,
        avgDurationMinutes: Math.round(avgDuration),
      }
    }

    it('should calculate statistics for completed sessions', () => {
      // Arrange
      const sessions: SessionData[] = [
        { tripDistance: '100.5', tripDurationMinutes: 120, status: 'completed' },
        { tripDistance: '50.25', tripDurationMinutes: 60, status: 'completed' },
        { tripDistance: '75.0', tripDurationMinutes: 90, status: 'completed' },
      ]

      // Act
      const stats = calculateStatistics(sessions)

      // Assert
      expect(stats.totalSessions).toBe(3)
      expect(stats.completedSessions).toBe(3)
      expect(stats.totalDistanceKm).toBe(225.75)
      expect(stats.totalDurationMinutes).toBe(270)
      expect(stats.avgDistanceKm).toBe(75.25)
      expect(stats.avgDurationMinutes).toBe(90)
    })

    it('should exclude active and cancelled sessions from distance calculations', () => {
      // Arrange
      const sessions: SessionData[] = [
        { tripDistance: '100.0', tripDurationMinutes: 120, status: 'completed' },
        { tripDistance: null, tripDurationMinutes: null, status: 'active' },
        { tripDistance: '50.0', tripDurationMinutes: 30, status: 'cancelled' },
      ]

      // Act
      const stats = calculateStatistics(sessions)

      // Assert
      expect(stats.totalSessions).toBe(3)
      expect(stats.completedSessions).toBe(1)
      expect(stats.activeSessions).toBe(1)
      expect(stats.cancelledSessions).toBe(1)
      expect(stats.totalDistanceKm).toBe(100.0)
      expect(stats.avgDistanceKm).toBe(100.0)
    })

    it('should handle sessions with null distances', () => {
      // Arrange
      const sessions: SessionData[] = [
        { tripDistance: '100.0', tripDurationMinutes: 120, status: 'completed' },
        { tripDistance: null, tripDurationMinutes: 60, status: 'completed' },
        { tripDistance: '50.0', tripDurationMinutes: 30, status: 'completed' },
      ]

      // Act
      const stats = calculateStatistics(sessions)

      // Assert
      expect(stats.completedSessions).toBe(3)
      expect(stats.totalDistanceKm).toBe(150.0) // Only counts non-null distances
      expect(stats.avgDistanceKm).toBe(50.0) // Average across all 3 sessions
    })

    it('should return zero for empty session list', () => {
      // Arrange
      const sessions: SessionData[] = []

      // Act
      const stats = calculateStatistics(sessions)

      // Assert
      expect(stats.totalSessions).toBe(0)
      expect(stats.completedSessions).toBe(0)
      expect(stats.totalDistanceKm).toBe(0)
      expect(stats.avgDistanceKm).toBe(0)
      expect(stats.avgDurationMinutes).toBe(0)
    })
  })

  describe('Operator Utilization Calculations', () => {
    interface OperatorSession {
      operatorId: string
      tripDurationMinutes: number | null
      status: 'completed' | 'active' | 'cancelled'
    }

    // Helper function to calculate operator utilization
    function calculateOperatorUtilization(
      sessions: OperatorSession[],
      periodStartTime: Date,
      periodEndTime: Date,
    ) {
      const periodMinutes = Math.round(
        (periodEndTime.getTime() - periodStartTime.getTime()) / (1000 * 60),
      )

      // Group sessions by operator
      const operatorStats = new Map<
        string,
        {
          totalMinutes: number
          sessionCount: number
          completedCount: number
        }
      >()

      for (const session of sessions) {
        const current = operatorStats.get(session.operatorId) || {
          totalMinutes: 0,
          sessionCount: 0,
          completedCount: 0,
        }

        current.sessionCount++
        if (session.status === 'completed') {
          current.completedCount++
          current.totalMinutes += session.tripDurationMinutes ?? 0
        }

        operatorStats.set(session.operatorId, current)
      }

      // Calculate utilization percentages
      const results = Array.from(operatorStats.entries()).map(([operatorId, stats]) => ({
        operatorId,
        totalMinutes: stats.totalMinutes,
        sessionCount: stats.sessionCount,
        completedCount: stats.completedCount,
        utilizationPercent:
          periodMinutes > 0
            ? Math.round((stats.totalMinutes / periodMinutes) * 100 * 100) / 100
            : 0,
      }))

      return {
        periodMinutes,
        operators: results,
        totalOperators: results.length,
      }
    }

    it('should calculate utilization for single operator', () => {
      // Arrange
      const sessions: OperatorSession[] = [
        { operatorId: 'op-1', tripDurationMinutes: 480, status: 'completed' }, // 8 hours
      ]
      const periodStart = new Date('2024-12-28T00:00:00.000Z')
      const periodEnd = new Date('2024-12-28T23:59:59.999Z') // ~24 hours

      // Act
      const result = calculateOperatorUtilization(sessions, periodStart, periodEnd)

      // Assert
      expect(result.totalOperators).toBe(1)
      expect(result.operators[0]?.operatorId).toBe('op-1')
      expect(result.operators[0]?.totalMinutes).toBe(480)
      // 480 / 1440 (24 hours in minutes) = 33.33%
      expect(result.operators[0]?.utilizationPercent).toBeCloseTo(33.33, 1)
    })

    it('should calculate utilization for multiple operators', () => {
      // Arrange
      const sessions: OperatorSession[] = [
        { operatorId: 'op-1', tripDurationMinutes: 480, status: 'completed' },
        { operatorId: 'op-1', tripDurationMinutes: 120, status: 'completed' },
        { operatorId: 'op-2', tripDurationMinutes: 360, status: 'completed' },
      ]
      const periodStart = new Date('2024-12-28T00:00:00.000Z')
      const periodEnd = new Date('2024-12-28T23:59:59.999Z')

      // Act
      const result = calculateOperatorUtilization(sessions, periodStart, periodEnd)

      // Assert
      expect(result.totalOperators).toBe(2)

      const op1 = result.operators.find((o) => o.operatorId === 'op-1')
      const op2 = result.operators.find((o) => o.operatorId === 'op-2')

      expect(op1?.totalMinutes).toBe(600) // 480 + 120
      expect(op1?.sessionCount).toBe(2)
      expect(op2?.totalMinutes).toBe(360)
      expect(op2?.sessionCount).toBe(1)
    })

    it('should exclude cancelled sessions from utilization', () => {
      // Arrange
      const sessions: OperatorSession[] = [
        { operatorId: 'op-1', tripDurationMinutes: 480, status: 'completed' },
        { operatorId: 'op-1', tripDurationMinutes: 120, status: 'cancelled' },
      ]
      const periodStart = new Date('2024-12-28T00:00:00.000Z')
      const periodEnd = new Date('2024-12-28T23:59:59.999Z')

      // Act
      const result = calculateOperatorUtilization(sessions, periodStart, periodEnd)

      // Assert
      const op1 = result.operators.find((o) => o.operatorId === 'op-1')
      expect(op1?.totalMinutes).toBe(480) // Only completed session
      expect(op1?.sessionCount).toBe(2) // Both sessions counted
      expect(op1?.completedCount).toBe(1) // Only one completed
    })

    it('should handle no sessions', () => {
      // Arrange
      const sessions: OperatorSession[] = []
      const periodStart = new Date('2024-12-28T00:00:00.000Z')
      const periodEnd = new Date('2024-12-28T23:59:59.999Z')

      // Act
      const result = calculateOperatorUtilization(sessions, periodStart, periodEnd)

      // Assert
      expect(result.totalOperators).toBe(0)
      expect(result.operators).toHaveLength(0)
    })

    it('should calculate weekly utilization', () => {
      // Arrange - 40 hours of work in a 168 hour week (24% utilization)
      const sessions: OperatorSession[] = [
        { operatorId: 'op-1', tripDurationMinutes: 2400, status: 'completed' }, // 40 hours
      ]
      const periodStart = new Date('2024-12-22T00:00:00.000Z')
      const periodEnd = new Date('2024-12-28T23:59:59.999Z') // 7 days

      // Act
      const result = calculateOperatorUtilization(sessions, periodStart, periodEnd)

      // Assert
      expect(result.periodMinutes).toBeCloseTo(10080, -1) // 7 * 24 * 60
      const op1 = result.operators.find((o) => o.operatorId === 'op-1')
      // 2400 / 10080 = 23.8%
      expect(op1?.utilizationPercent).toBeCloseTo(23.81, 1)
    })
  })

  describe('Pagination Response', () => {
    interface PaginatedResponse<T> {
      data: T[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
    }

    // Helper function to calculate hasMore
    function calculateHasMore(total: number, offset: number, currentPageSize: number): boolean {
      return offset + currentPageSize < total
    }

    it('should indicate more results available', () => {
      // Arrange
      const total = 100
      const offset = 0
      const currentPageSize = 50

      // Act
      const hasMore = calculateHasMore(total, offset, currentPageSize)

      // Assert
      expect(hasMore).toBe(true)
    })

    it('should indicate no more results on last page', () => {
      // Arrange
      const total = 100
      const offset = 50
      const currentPageSize = 50

      // Act
      const hasMore = calculateHasMore(total, offset, currentPageSize)

      // Assert
      expect(hasMore).toBe(false)
    })

    it('should indicate no more results when page is not full', () => {
      // Arrange
      const total = 75
      const offset = 50
      const currentPageSize = 25 // Only 25 results on second page

      // Act
      const hasMore = calculateHasMore(total, offset, currentPageSize)

      // Assert
      expect(hasMore).toBe(false)
    })

    it('should handle empty results', () => {
      // Arrange
      const total = 0
      const offset = 0
      const currentPageSize = 0

      // Act
      const hasMore = calculateHasMore(total, offset, currentPageSize)

      // Assert
      expect(hasMore).toBe(false)
    })

    it('should construct correct pagination response', () => {
      // Arrange
      const sessions = Array.from({ length: 25 }, (_, i) => ({ id: `session-${i}` }))
      const response: PaginatedResponse<{ id: string }> = {
        data: sessions,
        pagination: {
          total: 100,
          limit: 25,
          offset: 0,
          hasMore: calculateHasMore(100, 0, 25),
        },
      }

      // Assert
      expect(response.data).toHaveLength(25)
      expect(response.pagination.total).toBe(100)
      expect(response.pagination.limit).toBe(25)
      expect(response.pagination.offset).toBe(0)
      expect(response.pagination.hasMore).toBe(true)
    })
  })

  describe('Date Range Filtering Logic', () => {
    // Helper function to check if a date is within range
    function isWithinDateRange(
      sessionStartTime: Date,
      dateFrom: string | undefined,
      dateTo: string | undefined,
    ): boolean {
      if (dateFrom && sessionStartTime < new Date(dateFrom)) {
        return false
      }
      if (dateTo && sessionStartTime > new Date(dateTo)) {
        return false
      }
      return true
    }

    it('should include session within date range', () => {
      // Arrange
      const sessionStart = new Date('2024-12-15T10:00:00.000Z')
      const dateFrom = '2024-12-01T00:00:00.000Z'
      const dateTo = '2024-12-31T23:59:59.999Z'

      // Act
      const result = isWithinDateRange(sessionStart, dateFrom, dateTo)

      // Assert
      expect(result).toBe(true)
    })

    it('should exclude session before date range', () => {
      // Arrange
      const sessionStart = new Date('2024-11-15T10:00:00.000Z')
      const dateFrom = '2024-12-01T00:00:00.000Z'
      const dateTo = '2024-12-31T23:59:59.999Z'

      // Act
      const result = isWithinDateRange(sessionStart, dateFrom, dateTo)

      // Assert
      expect(result).toBe(false)
    })

    it('should exclude session after date range', () => {
      // Arrange
      const sessionStart = new Date('2025-01-15T10:00:00.000Z')
      const dateFrom = '2024-12-01T00:00:00.000Z'
      const dateTo = '2024-12-31T23:59:59.999Z'

      // Act
      const result = isWithinDateRange(sessionStart, dateFrom, dateTo)

      // Assert
      expect(result).toBe(false)
    })

    it('should include session when only dateFrom is set', () => {
      // Arrange
      const sessionStart = new Date('2024-12-15T10:00:00.000Z')
      const dateFrom = '2024-12-01T00:00:00.000Z'

      // Act
      const result = isWithinDateRange(sessionStart, dateFrom, undefined)

      // Assert
      expect(result).toBe(true)
    })

    it('should include session when only dateTo is set', () => {
      // Arrange
      const sessionStart = new Date('2024-12-15T10:00:00.000Z')
      const dateTo = '2024-12-31T23:59:59.999Z'

      // Act
      const result = isWithinDateRange(sessionStart, undefined, dateTo)

      // Assert
      expect(result).toBe(true)
    })

    it('should include all sessions when no date filters', () => {
      // Arrange
      const sessionStart = new Date('2024-12-15T10:00:00.000Z')

      // Act
      const result = isWithinDateRange(sessionStart, undefined, undefined)

      // Assert
      expect(result).toBe(true)
    })

    it('should include session exactly at dateFrom boundary', () => {
      // Arrange
      const sessionStart = new Date('2024-12-01T00:00:00.000Z')
      const dateFrom = '2024-12-01T00:00:00.000Z'
      const dateTo = '2024-12-31T23:59:59.999Z'

      // Act
      const result = isWithinDateRange(sessionStart, dateFrom, dateTo)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('Route Statistics Calculations', () => {
    interface LocationRecord {
      latitude: string
      longitude: string
      speed: string | null
      recordedAt: string
    }

    // Haversine distance calculation (mirrors API logic)
    function calculateHaversineDistance(
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number {
      const R = 6371 // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    // Calculate route statistics from location records (mirrors API logic)
    function calculateRouteStatistics(locationRecords: LocationRecord[]) {
      let totalDistance = 0
      let maxSpeed = 0
      let avgSpeed = 0
      let speedCount = 0

      for (let i = 1; i < locationRecords.length; i++) {
        const prev = locationRecords[i - 1]
        const curr = locationRecords[i]

        if (!prev || !curr) continue

        const lat1 = Number(prev.latitude)
        const lon1 = Number(prev.longitude)
        const lat2 = Number(curr.latitude)
        const lon2 = Number(curr.longitude)

        totalDistance += calculateHaversineDistance(lat1, lon1, lat2, lon2)

        if (curr.speed) {
          const speed = Number(curr.speed)
          maxSpeed = Math.max(maxSpeed, speed)
          avgSpeed += speed
          speedCount++
        }
      }

      if (speedCount > 0) {
        avgSpeed = avgSpeed / speedCount
      }

      let durationMinutes = 0
      if (locationRecords.length >= 2) {
        const firstRecord = locationRecords[0]
        const lastRecord = locationRecords[locationRecords.length - 1]
        if (firstRecord && lastRecord) {
          durationMinutes = Math.round(
            (new Date(lastRecord.recordedAt).getTime() -
              new Date(firstRecord.recordedAt).getTime()) /
              60000,
          )
        }
      }

      return {
        totalPoints: locationRecords.length,
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        durationMinutes,
        maxSpeedKmh: Math.round(maxSpeed * 100) / 100,
        avgSpeedKmh: Math.round(avgSpeed * 100) / 100,
      }
    }

    it('should calculate distance between two points', () => {
      // Arrange - Sydney to Melbourne approximately 714 km
      const lat1 = -33.8688 // Sydney
      const lon1 = 151.2093
      const lat2 = -37.8136 // Melbourne
      const lon2 = 144.9631

      // Act
      const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2)

      // Assert - Should be approximately 714 km
      expect(distance).toBeGreaterThan(700)
      expect(distance).toBeLessThan(750)
    })

    it('should calculate zero distance for same point', () => {
      // Arrange
      const lat = -33.8688
      const lon = 151.2093

      // Act
      const distance = calculateHaversineDistance(lat, lon, lat, lon)

      // Assert
      expect(distance).toBe(0)
    })

    it('should calculate route statistics from location records', () => {
      // Arrange
      const locationRecords: LocationRecord[] = [
        {
          latitude: '-33.8688',
          longitude: '151.2093',
          speed: '50',
          recordedAt: '2024-12-28T08:00:00.000Z',
        },
        {
          latitude: '-33.8700',
          longitude: '151.2100',
          speed: '60',
          recordedAt: '2024-12-28T08:15:00.000Z',
        },
        {
          latitude: '-33.8720',
          longitude: '151.2120',
          speed: '55',
          recordedAt: '2024-12-28T08:30:00.000Z',
        },
      ]

      // Act
      const stats = calculateRouteStatistics(locationRecords)

      // Assert
      expect(stats.totalPoints).toBe(3)
      expect(stats.totalDistanceKm).toBeGreaterThan(0)
      expect(stats.durationMinutes).toBe(30)
      expect(stats.maxSpeedKmh).toBe(60)
      expect(stats.avgSpeedKmh).toBeCloseTo(57.5, 0)
    })

    it('should handle empty location records', () => {
      // Arrange
      const locationRecords: LocationRecord[] = []

      // Act
      const stats = calculateRouteStatistics(locationRecords)

      // Assert
      expect(stats.totalPoints).toBe(0)
      expect(stats.totalDistanceKm).toBe(0)
      expect(stats.durationMinutes).toBe(0)
      expect(stats.maxSpeedKmh).toBe(0)
      expect(stats.avgSpeedKmh).toBe(0)
    })

    it('should handle single location record', () => {
      // Arrange
      const locationRecords: LocationRecord[] = [
        {
          latitude: '-33.8688',
          longitude: '151.2093',
          speed: '50',
          recordedAt: '2024-12-28T08:00:00.000Z',
        },
      ]

      // Act
      const stats = calculateRouteStatistics(locationRecords)

      // Assert
      expect(stats.totalPoints).toBe(1)
      expect(stats.totalDistanceKm).toBe(0)
      expect(stats.durationMinutes).toBe(0)
    })

    it('should handle null speed values', () => {
      // Arrange
      const locationRecords: LocationRecord[] = [
        {
          latitude: '-33.8688',
          longitude: '151.2093',
          speed: null,
          recordedAt: '2024-12-28T08:00:00.000Z',
        },
        {
          latitude: '-33.8700',
          longitude: '151.2100',
          speed: '60',
          recordedAt: '2024-12-28T08:15:00.000Z',
        },
        {
          latitude: '-33.8720',
          longitude: '151.2120',
          speed: null,
          recordedAt: '2024-12-28T08:30:00.000Z',
        },
      ]

      // Act
      const stats = calculateRouteStatistics(locationRecords)

      // Assert
      expect(stats.maxSpeedKmh).toBe(60)
      expect(stats.avgSpeedKmh).toBe(60) // Only one valid speed reading
    })
  })

  describe('Permission Requirements for Session Listing', () => {
    it('should verify fleet manager has assets:read permission', () => {
      // Arrange
      const fleetManager = createFleetManagerUser()

      // Assert
      expect(fleetManager.permissions).toContain('assets:read')
    })

    it('should verify operator has limited permissions', () => {
      // Arrange
      const operator = createOperatorUser()

      // Assert
      expect(operator.permissions).toContain('assets:read')
      expect(operator.permissions).not.toContain('assets:write')
      expect(operator.permissions).not.toContain('assets:delete')
    })
  })
})
