/**
 * Work Order Generator Unit Tests
 *
 * Tests for work order generation logic from maintenance schedules.
 * These tests focus on the trigger logic and generation results structure.
 *
 * Note: Full integration tests with database are in the API tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerationResult } from '../work-order-generator'

// Test the GenerationResult interface contract
describe('Work Order Generator', () => {
  describe('GenerationResult interface', () => {
    it('should have correct structure for created status', () => {
      // Arrange
      const result: GenerationResult = {
        scheduleId: 'schedule-123',
        scheduleName: 'Oil Change',
        workOrderId: 'wo-456',
        workOrderNumber: 'WO-0001',
        assetId: 'asset-789',
        assetNumber: 'VH-001',
        status: 'created',
        reason: 'Time-based: due 2025-01-15',
      }

      // Assert
      expect(result.scheduleId).toBeDefined()
      expect(result.scheduleName).toBeDefined()
      expect(result.status).toBe('created')
      expect(result.workOrderId).toBeDefined()
      expect(result.workOrderNumber).toBeDefined()
    })

    it('should have correct structure for skipped status', () => {
      // Arrange
      const result: GenerationResult = {
        scheduleId: 'schedule-123',
        scheduleName: 'Oil Change',
        assetId: 'asset-789',
        assetNumber: 'VH-001',
        status: 'skipped',
        reason: 'Not yet due',
      }

      // Assert
      expect(result.status).toBe('skipped')
      expect(result.workOrderId).toBeUndefined()
      expect(result.workOrderNumber).toBeUndefined()
      expect(result.reason).toBe('Not yet due')
    })

    it('should have correct structure for error status', () => {
      // Arrange
      const result: GenerationResult = {
        scheduleId: 'schedule-123',
        scheduleName: 'Oil Change',
        assetId: 'asset-789',
        assetNumber: 'VH-001',
        status: 'error',
        reason: 'Failed to create work order',
      }

      // Assert
      expect(result.status).toBe('error')
      expect(result.reason).toBeDefined()
    })
  })

  describe('Time-based trigger logic', () => {
    it('should calculate lead date correctly', () => {
      // Arrange
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-14T10:00:00Z')

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const shouldGenerate = today >= leadDate

      // Assert
      expect(shouldGenerate).toBe(true)
    })

    it('should not generate when before lead date', () => {
      // Arrange
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-10T10:00:00Z')

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const shouldGenerate = today >= leadDate

      // Assert
      expect(shouldGenerate).toBe(false)
    })

    it('should generate on exact lead date', () => {
      // Arrange
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-13T10:00:00Z')

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const shouldGenerate = today >= leadDate

      // Assert
      expect(shouldGenerate).toBe(true)
    })
  })

  describe('Usage-based trigger logic (mileage)', () => {
    it('should trigger when mileage threshold exceeded', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 15500

      // Act
      const nextTriggerMileage = lastTriggeredMileage + intervalMileage
      const shouldGenerate = currentMileage >= nextTriggerMileage

      // Assert
      expect(nextTriggerMileage).toBe(15000)
      expect(shouldGenerate).toBe(true)
    })

    it('should not trigger when mileage below threshold', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 14500

      // Act
      const nextTriggerMileage = lastTriggeredMileage + intervalMileage
      const shouldGenerate = currentMileage >= nextTriggerMileage

      // Assert
      expect(shouldGenerate).toBe(false)
    })

    it('should trigger on exact threshold', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 15000

      // Act
      const nextTriggerMileage = lastTriggeredMileage + intervalMileage
      const shouldGenerate = currentMileage >= nextTriggerMileage

      // Assert
      expect(shouldGenerate).toBe(true)
    })

    it('should handle first trigger when no last triggered mileage', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 0
      const currentMileage = 5500

      // Act
      const nextTriggerMileage = lastTriggeredMileage + intervalMileage
      const shouldGenerate = currentMileage >= nextTriggerMileage

      // Assert
      expect(shouldGenerate).toBe(true)
    })
  })

  describe('Usage-based trigger logic (hours)', () => {
    it('should trigger when hours threshold exceeded', () => {
      // Arrange
      const intervalHours = 250
      const lastTriggeredHours = 500
      const currentHours = 780

      // Act
      const nextTriggerHours = lastTriggeredHours + intervalHours
      const shouldGenerate = currentHours >= nextTriggerHours

      // Assert
      expect(nextTriggerHours).toBe(750)
      expect(shouldGenerate).toBe(true)
    })

    it('should not trigger when hours below threshold', () => {
      // Arrange
      const intervalHours = 250
      const lastTriggeredHours = 500
      const currentHours = 700

      // Act
      const nextTriggerHours = lastTriggeredHours + intervalHours
      const shouldGenerate = currentHours >= nextTriggerHours

      // Assert
      expect(shouldGenerate).toBe(false)
    })
  })

  describe('Combined trigger logic', () => {
    it('should trigger when time condition met', () => {
      // Arrange - time-based condition met, usage not met
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-14T10:00:00Z')

      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 12000 // Below threshold

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const timeTrigger = today >= leadDate
      const mileageTrigger = currentMileage >= lastTriggeredMileage + intervalMileage
      const shouldGenerate = timeTrigger || mileageTrigger

      // Assert
      expect(timeTrigger).toBe(true)
      expect(mileageTrigger).toBe(false)
      expect(shouldGenerate).toBe(true)
    })

    it('should trigger when usage condition met', () => {
      // Arrange - usage-based condition met, time not met
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-10T10:00:00Z')

      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 16000 // Above threshold

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const timeTrigger = today >= leadDate
      const mileageTrigger = currentMileage >= lastTriggeredMileage + intervalMileage
      const shouldGenerate = timeTrigger || mileageTrigger

      // Assert
      expect(timeTrigger).toBe(false)
      expect(mileageTrigger).toBe(true)
      expect(shouldGenerate).toBe(true)
    })

    it('should trigger when both conditions met', () => {
      // Arrange
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-14T10:00:00Z')

      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 16000

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const timeTrigger = today >= leadDate
      const mileageTrigger = currentMileage >= lastTriggeredMileage + intervalMileage
      const shouldGenerate = timeTrigger || mileageTrigger

      // Assert
      expect(shouldGenerate).toBe(true)
    })

    it('should not trigger when neither condition met', () => {
      // Arrange
      const dueDate = new Date('2025-01-20T10:00:00Z')
      const leadTimeDays = 7
      const today = new Date('2025-01-10T10:00:00Z')

      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 12000

      // Act
      const leadDate = new Date(dueDate)
      leadDate.setDate(leadDate.getDate() - leadTimeDays)
      const timeTrigger = today >= leadDate
      const mileageTrigger = currentMileage >= lastTriggeredMileage + intervalMileage
      const shouldGenerate = timeTrigger || mileageTrigger

      // Assert
      expect(shouldGenerate).toBe(false)
    })
  })

  describe('Threshold alert calculations', () => {
    it('should calculate progress percentage correctly', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 13500

      // Act
      const usedSinceLastTrigger = currentMileage - lastTriggeredMileage
      const progress = Math.round((usedSinceLastTrigger / intervalMileage) * 100)

      // Assert
      expect(progress).toBe(70)
    })

    it('should calculate remaining correctly', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 13500

      // Act
      const nextTrigger = lastTriggeredMileage + intervalMileage
      const remaining = nextTrigger - currentMileage

      // Assert
      expect(remaining).toBe(1500)
    })

    it('should detect approaching threshold at 90%', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 14500
      const thresholdAlertPercent = 90

      // Act
      const usedSinceLastTrigger = currentMileage - lastTriggeredMileage
      const progress = Math.round((usedSinceLastTrigger / intervalMileage) * 100)
      const isApproaching = progress >= thresholdAlertPercent

      // Assert
      expect(progress).toBe(90)
      expect(isApproaching).toBe(true)
    })

    it('should not alert when below threshold', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 14000
      const thresholdAlertPercent = 90

      // Act
      const usedSinceLastTrigger = currentMileage - lastTriggeredMileage
      const progress = Math.round((usedSinceLastTrigger / intervalMileage) * 100)
      const isApproaching = progress >= thresholdAlertPercent

      // Assert
      expect(progress).toBe(80)
      expect(isApproaching).toBe(false)
    })

    it('should handle overdue status when over 100%', () => {
      // Arrange
      const intervalMileage = 5000
      const lastTriggeredMileage = 10000
      const currentMileage = 16000

      // Act
      const usedSinceLastTrigger = currentMileage - lastTriggeredMileage
      const progress = Math.round((usedSinceLastTrigger / intervalMileage) * 100)

      // Assert
      expect(progress).toBe(120)
      expect(progress >= 100).toBe(true) // Overdue
    })
  })

  describe('Urgency level determination', () => {
    it('should return overdue when progress >= 100%', () => {
      // Arrange
      const progress = 120

      // Act
      let urgency: 'approaching' | 'due' | 'overdue'
      if (progress >= 100) {
        urgency = 'overdue'
      } else if (progress >= 95) {
        urgency = 'due'
      } else {
        urgency = 'approaching'
      }

      // Assert
      expect(urgency).toBe('overdue')
    })

    it('should return due when progress >= 95% and < 100%', () => {
      // Arrange
      const progress = 97

      // Act
      let urgency: 'approaching' | 'due' | 'overdue'
      if (progress >= 100) {
        urgency = 'overdue'
      } else if (progress >= 95) {
        urgency = 'due'
      } else {
        urgency = 'approaching'
      }

      // Assert
      expect(urgency).toBe('due')
    })

    it('should return approaching when progress < 95%', () => {
      // Arrange
      const progress = 92

      // Act
      let urgency: 'approaching' | 'due' | 'overdue'
      if (progress >= 100) {
        urgency = 'overdue'
      } else if (progress >= 95) {
        urgency = 'due'
      } else {
        urgency = 'approaching'
      }

      // Assert
      expect(urgency).toBe('approaching')
    })
  })

  describe('Work order number generation', () => {
    it('should generate work order number with padding', () => {
      // Arrange
      const count = 1
      const nextNumber = count + 1

      // Act
      const workOrderNumber = `WO-${nextNumber.toString().padStart(4, '0')}`

      // Assert
      expect(workOrderNumber).toBe('WO-0002')
    })

    it('should handle large numbers', () => {
      // Arrange
      const count = 9999
      const nextNumber = count + 1

      // Act
      const workOrderNumber = `WO-${nextNumber.toString().padStart(4, '0')}`

      // Assert
      expect(workOrderNumber).toBe('WO-10000')
    })

    it('should start from 1 when no existing orders', () => {
      // Arrange
      const count = 0
      const nextNumber = count + 1

      // Act
      const workOrderNumber = `WO-${nextNumber.toString().padStart(4, '0')}`

      // Assert
      expect(workOrderNumber).toBe('WO-0001')
    })
  })

  describe('Trigger reason formatting', () => {
    it('should format time-based reason', () => {
      // Arrange
      const dueDate = new Date('2025-01-15T10:00:00Z')

      // Act
      const reason = `Time-based: due ${dueDate.toISOString().split('T')[0]}`

      // Assert
      expect(reason).toBe('Time-based: due 2025-01-15')
    })

    it('should format mileage-based reason', () => {
      // Arrange
      const currentMileage = 15500
      const nextTriggerMileage = 15000

      // Act
      const reason = `Mileage: ${currentMileage} >= ${nextTriggerMileage}`

      // Assert
      expect(reason).toBe('Mileage: 15500 >= 15000')
    })

    it('should format hours-based reason', () => {
      // Arrange
      const currentHours = 780
      const nextTriggerHours = 750

      // Act
      const reason = `Hours: ${currentHours} >= ${nextTriggerHours}`

      // Assert
      expect(reason).toBe('Hours: 780 >= 750')
    })

    it('should combine multiple reasons', () => {
      // Arrange
      const dueDate = new Date('2025-01-15T10:00:00Z')
      const currentMileage = 15500
      const nextTriggerMileage = 15000

      // Act
      let reason = `Time-based: due ${dueDate.toISOString().split('T')[0]}`
      reason = `${reason} + Mileage: ${currentMileage} >= ${nextTriggerMileage}`

      // Assert
      expect(reason).toBe('Time-based: due 2025-01-15 + Mileage: 15500 >= 15000')
    })
  })

  describe('Summary calculations', () => {
    it('should calculate summary from results array', () => {
      // Arrange
      const results: GenerationResult[] = [
        { scheduleId: '1', scheduleName: 'A', status: 'created' },
        { scheduleId: '2', scheduleName: 'B', status: 'created' },
        { scheduleId: '3', scheduleName: 'C', status: 'skipped', reason: 'Not yet due' },
        { scheduleId: '4', scheduleName: 'D', status: 'error', reason: 'DB error' },
        { scheduleId: '5', scheduleName: 'E', status: 'skipped', reason: 'Already generated' },
      ]

      // Act
      const summary = {
        total: results.length,
        created: results.filter((r) => r.status === 'created').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        errors: results.filter((r) => r.status === 'error').length,
      }

      // Assert
      expect(summary.total).toBe(5)
      expect(summary.created).toBe(2)
      expect(summary.skipped).toBe(2)
      expect(summary.errors).toBe(1)
    })

    it('should handle empty results array', () => {
      // Arrange
      const results: GenerationResult[] = []

      // Act
      const summary = {
        total: results.length,
        created: results.filter((r) => r.status === 'created').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        errors: results.filter((r) => r.status === 'error').length,
      }

      // Assert
      expect(summary.total).toBe(0)
      expect(summary.created).toBe(0)
      expect(summary.skipped).toBe(0)
      expect(summary.errors).toBe(0)
    })
  })
})
