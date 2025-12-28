/**
 * Schedule Calculator Unit Tests
 *
 * Tests for the maintenance schedule calculation utilities
 * covering time-based calculations, edge cases, and preview generation.
 */
import { describe, expect, it } from 'vitest'
import { calculateNextDueDate, previewScheduleOccurrences } from '../schedule-calculator'

describe('Schedule Calculator', () => {
  describe('calculateNextDueDate', () => {
    describe('daily intervals', () => {
      it('should calculate next due date for daily interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('daily', 1, fromDate)

        // Assert
        expect(result.getFullYear()).toBe(2025)
        expect(result.getMonth()).toBe(0) // January
        expect(result.getDate()).toBe(16)
      })

      it('should calculate next due date for every 3 days', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('daily', 3, fromDate)

        // Assert
        expect(result.getDate()).toBe(18)
      })

      it('should handle month boundary for daily interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-30T10:00:00Z')

        // Act
        const result = calculateNextDueDate('daily', 5, fromDate)

        // Assert
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(4)
      })
    })

    describe('weekly intervals', () => {
      it('should calculate next due date for weekly interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('weekly', 1, fromDate)

        // Assert
        expect(result.getDate()).toBe(22)
      })

      it('should calculate next due date for every 2 weeks', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('weekly', 2, fromDate)

        // Assert
        expect(result.getDate()).toBe(29)
      })

      it('should adjust to specific day of week', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z') // Wednesday
        const dayOfWeek = 5 // Friday

        // Act
        const result = calculateNextDueDate('weekly', 1, fromDate, dayOfWeek)

        // Assert
        // Should add 7 days, then adjust to Friday
        expect(result.getDay()).toBe(5) // Friday
      })

      it('should handle Sunday (day 0) correctly', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z') // Wednesday
        const dayOfWeek = 0 // Sunday

        // Act
        const result = calculateNextDueDate('weekly', 1, fromDate, dayOfWeek)

        // Assert
        expect(result.getDay()).toBe(0) // Sunday
      })

      it('should handle Saturday (day 6) correctly', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z') // Wednesday
        const dayOfWeek = 6 // Saturday

        // Act
        const result = calculateNextDueDate('weekly', 1, fromDate, dayOfWeek)

        // Assert
        expect(result.getDay()).toBe(6) // Saturday
      })
    })

    describe('monthly intervals', () => {
      it('should calculate next due date for monthly interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate)

        // Assert
        expect(result.getMonth()).toBe(1) // February
      })

      it('should calculate next due date for every 3 months', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('monthly', 3, fromDate)

        // Assert
        expect(result.getMonth()).toBe(3) // April
      })

      it('should set specific day of month', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')
        const dayOfMonth = 20

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate, null, dayOfMonth)

        // Assert
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(20)
      })

      it('should handle day overflow for February (non-leap year)', () => {
        // Arrange: Start from Jan 28 to avoid JS Date overflow
        // When adding a month to Jan 31, JS Date auto-overflows to March
        const fromDate = new Date('2025-01-28T10:00:00Z')
        const dayOfMonth = 31

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate, null, dayOfMonth)

        // Assert: February 2025 only has 28 days, so day 31 becomes 28
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(28) // Last day of February
      })

      it('should handle day overflow for February (leap year)', () => {
        // Arrange: Start from Jan 28 to avoid JS Date overflow
        const fromDate = new Date('2024-01-28T10:00:00Z')
        const dayOfMonth = 31

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate, null, dayOfMonth)

        // Assert: February 2024 has 29 days (leap year), so day 31 becomes 29
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(29) // Last day of leap February
      })

      it('should handle day 30 in month with 31 days', () => {
        // Arrange
        const fromDate = new Date('2025-02-15T10:00:00Z')
        const dayOfMonth = 30

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate, null, dayOfMonth)

        // Assert
        expect(result.getMonth()).toBe(2) // March
        expect(result.getDate()).toBe(30)
      })

      it('should handle year boundary', () => {
        // Arrange
        const fromDate = new Date('2025-11-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('monthly', 3, fromDate)

        // Assert
        expect(result.getFullYear()).toBe(2026)
        expect(result.getMonth()).toBe(1) // February
      })
    })

    describe('quarterly intervals', () => {
      it('should calculate next due date for quarterly interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('quarterly', 1, fromDate)

        // Assert
        expect(result.getMonth()).toBe(3) // April
      })

      it('should calculate next due date for every 2 quarters', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('quarterly', 2, fromDate)

        // Assert
        expect(result.getMonth()).toBe(6) // July
      })

      it('should set specific day of month for quarterly', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')
        const dayOfMonth = 10

        // Act
        const result = calculateNextDueDate('quarterly', 1, fromDate, null, dayOfMonth)

        // Assert
        expect(result.getMonth()).toBe(3) // April
        expect(result.getDate()).toBe(10)
      })

      it('should handle day overflow for quarterly February target', () => {
        // Arrange: Start from Nov 28 to avoid JS Date auto-overflow
        const fromDate = new Date('2025-11-28T10:00:00Z')
        const dayOfMonth = 30

        // Act
        const result = calculateNextDueDate('quarterly', 1, fromDate, null, dayOfMonth)

        // Assert: February only has 28 days in 2026, so day 30 becomes 28
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(28)
      })
    })

    describe('annually intervals', () => {
      it('should calculate next due date for annual interval', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('annually', 1, fromDate)

        // Assert
        expect(result.getFullYear()).toBe(2026)
      })

      it('should calculate next due date for every 2 years', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('annually', 2, fromDate)

        // Assert
        expect(result.getFullYear()).toBe(2027)
      })

      it('should set specific month of year', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')
        const monthOfYear = 6 // June

        // Act
        const result = calculateNextDueDate('annually', 1, fromDate, null, null, monthOfYear)

        // Assert
        expect(result.getFullYear()).toBe(2026)
        expect(result.getMonth()).toBe(5) // June (0-indexed)
      })

      it('should set specific day and month', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')
        const dayOfMonth = 25
        const monthOfYear = 12 // December

        // Act
        const result = calculateNextDueDate('annually', 1, fromDate, null, dayOfMonth, monthOfYear)

        // Assert
        expect(result.getFullYear()).toBe(2026)
        expect(result.getMonth()).toBe(11) // December (0-indexed)
        expect(result.getDate()).toBe(25)
      })

      it('should handle Feb 29 in non-leap year', () => {
        // Arrange
        const fromDate = new Date('2024-02-29T10:00:00Z') // Leap year
        const dayOfMonth = 29
        const monthOfYear = 2 // February

        // Act
        const result = calculateNextDueDate('annually', 1, fromDate, null, dayOfMonth, monthOfYear)

        // Assert: 2025 is not a leap year
        expect(result.getFullYear()).toBe(2025)
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(28) // Last day of non-leap February
      })
    })

    describe('custom intervals', () => {
      it('should calculate custom interval in days', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('custom', 10, fromDate)

        // Assert
        expect(result.getDate()).toBe(25)
      })

      it('should handle large custom intervals', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('custom', 45, fromDate)

        // Assert
        expect(result.getMonth()).toBe(2) // March
        expect(result.getDate()).toBe(1)
      })
    })

    describe('null and undefined parameters', () => {
      it('should handle null dayOfWeek', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('weekly', 1, fromDate, null)

        // Assert
        expect(result.getDate()).toBe(22)
      })

      it('should handle undefined dayOfMonth', () => {
        // Arrange
        const fromDate = new Date('2025-01-15T10:00:00Z')

        // Act
        const result = calculateNextDueDate('monthly', 1, fromDate, null, undefined)

        // Assert
        expect(result.getMonth()).toBe(1) // February
        expect(result.getDate()).toBe(15) // Same day as input
      })
    })
  })

  describe('previewScheduleOccurrences', () => {
    it('should generate correct number of occurrences', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config, 5)

      // Assert
      expect(result).toHaveLength(5)
    })

    it('should generate sequential due dates', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config, 3)

      // Assert
      expect(result[0].dueDate.getMonth()).toBe(1) // February
      expect(result[1].dueDate.getMonth()).toBe(2) // March
      expect(result[2].dueDate.getMonth()).toBe(3) // April
    })

    it('should calculate lead dates correctly', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config, 1)

      // Assert
      const dueDate = result[0].dueDate
      const leadDate = result[0].leadDate
      const diffMs = dueDate.getTime() - leadDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(7)
    })

    it('should stop at end date', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        endDate: new Date('2025-03-01T10:00:00Z'),
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config, 10)

      // Assert: Only 1 occurrence (February) should be before end date
      expect(result.length).toBeLessThan(10)
      result.forEach((occurrence) => {
        expect(occurrence.dueDate <= config.endDate!).toBe(true)
      })
    })

    it('should use default count of 10', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config)

      // Assert
      expect(result).toHaveLength(10)
    })

    it('should handle weekly with day of week', () => {
      // Arrange
      const config = {
        intervalType: 'weekly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'), // Wednesday
        dayOfWeek: 1, // Monday
        leadTimeDays: 3,
      }

      // Act
      const result = previewScheduleOccurrences(config, 3)

      // Assert
      result.forEach((occurrence) => {
        expect(occurrence.dueDate.getDay()).toBe(1) // All should be Monday
      })
    })

    it('should handle quarterly with day of month', () => {
      // Arrange
      const config = {
        intervalType: 'quarterly',
        intervalValue: 1,
        startDate: new Date('2025-01-01T10:00:00Z'),
        dayOfMonth: 15,
        leadTimeDays: 14,
      }

      // Act
      const result = previewScheduleOccurrences(config, 4)

      // Assert
      expect(result[0].dueDate.getMonth()).toBe(3) // April
      expect(result[0].dueDate.getDate()).toBe(15)
      expect(result[1].dueDate.getMonth()).toBe(6) // July
      expect(result[2].dueDate.getMonth()).toBe(9) // October
      expect(result[3].dueDate.getFullYear()).toBe(2026)
      expect(result[3].dueDate.getMonth()).toBe(0) // January
    })

    it('should handle annually with month and day', () => {
      // Arrange
      const config = {
        intervalType: 'annually',
        intervalValue: 1,
        startDate: new Date('2025-01-01T10:00:00Z'),
        dayOfMonth: 25,
        monthOfYear: 12, // December
        leadTimeDays: 30,
      }

      // Act
      const result = previewScheduleOccurrences(config, 3)

      // Assert: First occurrence is 1 year from start, then set to December 25
      expect(result[0].dueDate.getFullYear()).toBe(2026)
      expect(result[0].dueDate.getMonth()).toBe(11) // December
      expect(result[0].dueDate.getDate()).toBe(25)
      expect(result[1].dueDate.getFullYear()).toBe(2027)
      expect(result[2].dueDate.getFullYear()).toBe(2028)
    })

    it('should handle zero lead time days', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 0,
      }

      // Act
      const result = previewScheduleOccurrences(config, 1)

      // Assert
      expect(result[0].leadDate.getTime()).toBe(result[0].dueDate.getTime())
    })

    it('should handle large lead time days', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        leadTimeDays: 30,
      }

      // Act
      const result = previewScheduleOccurrences(config, 1)

      // Assert
      const diffMs = result[0].dueDate.getTime() - result[0].leadDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(30)
    })

    it('should return empty array when end date is before first occurrence', () => {
      // Arrange
      const config = {
        intervalType: 'monthly',
        intervalValue: 1,
        startDate: new Date('2025-01-15T10:00:00Z'),
        endDate: new Date('2025-01-20T10:00:00Z'), // Before first occurrence
        leadTimeDays: 7,
      }

      // Act
      const result = previewScheduleOccurrences(config, 10)

      // Assert
      expect(result).toHaveLength(0)
    })
  })
})
