/**
 * Maintenance Schedules API Tests
 *
 * Tests for maintenance schedule validation, creation, and threshold calculations.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { resetFixtures } from '../../../../tests/helpers'

// Define the schema locally for testing (mirrors the API validation)
const createScheduleSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional().nullable(),
    assetId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
    scheduleType: z.enum(['time_based', 'usage_based', 'combined']).default('time_based'),
    intervalType: z
      .enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'])
      .optional()
      .nullable(),
    intervalValue: z.number().int().positive().default(1),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
    monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    intervalMileage: z.number().int().positive().optional().nullable(),
    intervalHours: z.number().int().positive().optional().nullable(),
    thresholdAlertPercent: z.number().int().min(1).max(100).default(90),
    leadTimeDays: z.number().int().min(0).default(7),
    defaultPriority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    defaultAssigneeId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      const hasAsset = !!data.assetId
      const hasCategory = !!data.categoryId
      return (hasAsset || hasCategory) && !(hasAsset && hasCategory)
    },
    {
      message: 'Either assetId or categoryId must be provided, but not both',
      path: ['assetId'],
    },
  )
  .refine(
    (data) => {
      if (data.scheduleType === 'time_based' || data.scheduleType === 'combined') {
        return !!data.intervalType && !!data.startDate
      }
      return true
    },
    {
      message: 'intervalType and startDate are required for time_based and combined schedules',
      path: ['intervalType'],
    },
  )
  .refine(
    (data) => {
      if (data.scheduleType === 'usage_based' || data.scheduleType === 'combined') {
        return !!data.intervalMileage || !!data.intervalHours
      }
      return true
    },
    {
      message:
        'At least one of intervalMileage or intervalHours is required for usage_based and combined schedules',
      path: ['intervalMileage'],
    },
  )

describe('Maintenance Schedules API', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('Schedule Schema Validation', () => {
    describe('Basic field validation', () => {
      it('should validate name is required', () => {
        // Arrange
        const input = {
          name: '',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true)
        }
      })

      it('should validate name max length', () => {
        // Arrange
        const input = {
          name: 'a'.repeat(201),
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept valid name', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept optional description', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          description: 'Change oil and filter every month',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBe('Change oil and filter every month')
        }
      })

      it('should accept null description', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          description: null,
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('Asset and category validation', () => {
      it('should require either assetId or categoryId', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should not allow both assetId and categoryId', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          categoryId: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept only assetId', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept only categoryId', () => {
        // Arrange
        const input = {
          name: 'Fleet-wide Inspection',
          categoryId: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
          scheduleType: 'time_based',
          intervalType: 'quarterly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should validate assetId is valid UUID', () => {
        // Arrange
        const input = {
          name: 'Monthly Oil Change',
          assetId: 'not-a-uuid',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('Schedule type validation', () => {
      it('should accept time_based schedule type', () => {
        // Arrange
        const input = {
          name: 'Monthly Inspection',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept usage_based schedule type', () => {
        // Arrange
        const input = {
          name: 'Oil Change by Mileage',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept combined schedule type', () => {
        // Arrange
        const input = {
          name: 'Oil Change (Time or Mileage)',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'combined',
          intervalType: 'monthly',
          intervalValue: 3,
          startDate: '2025-01-15T10:00:00Z',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid schedule type', () => {
        // Arrange
        const input = {
          name: 'Test Schedule',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'invalid_type',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('Time-based schedule requirements', () => {
      it('should require intervalType for time_based schedules', () => {
        // Arrange
        const input = {
          name: 'Monthly Inspection',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should require startDate for time_based schedules', () => {
        // Arrange
        const input = {
          name: 'Monthly Inspection',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should require both intervalType and startDate for combined schedules', () => {
        // Arrange
        const input = {
          name: 'Combined Schedule',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'combined',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('Usage-based schedule requirements', () => {
      it('should require at least intervalMileage for usage_based schedules', () => {
        // Arrange
        const input = {
          name: 'Mileage-based Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should require at least intervalHours for usage_based schedules', () => {
        // Arrange
        const input = {
          name: 'Hours-based Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalHours: 250,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept both intervalMileage and intervalHours', () => {
        // Arrange
        const input = {
          name: 'Dual-trigger Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          intervalHours: 250,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject usage_based without mileage or hours', () => {
        // Arrange
        const input = {
          name: 'Invalid Usage Schedule',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should require usage metrics for combined schedules', () => {
        // Arrange
        const input = {
          name: 'Combined without Usage',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'combined',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('Interval type validation', () => {
      it('should accept daily interval type', () => {
        // Arrange
        const input = {
          name: 'Daily Check',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'daily',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept weekly interval type', () => {
        // Arrange
        const input = {
          name: 'Weekly Check',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'weekly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept monthly interval type', () => {
        // Arrange
        const input = {
          name: 'Monthly Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept quarterly interval type', () => {
        // Arrange
        const input = {
          name: 'Quarterly Inspection',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'quarterly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept annually interval type', () => {
        // Arrange
        const input = {
          name: 'Annual Certification',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'annually',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept custom interval type', () => {
        // Arrange
        const input = {
          name: 'Every 45 Days',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'custom',
          intervalValue: 45,
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('Day/month constraints', () => {
      it('should validate dayOfWeek is between 0-6', () => {
        // Arrange
        const validInput = {
          name: 'Weekly on Monday',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'weekly',
          dayOfWeek: 1,
          startDate: '2025-01-15T10:00:00Z',
        }

        const invalidInput = {
          ...validInput,
          dayOfWeek: 7,
        }

        // Act
        const validResult = createScheduleSchema.safeParse(validInput)
        const invalidResult = createScheduleSchema.safeParse(invalidInput)

        // Assert
        expect(validResult.success).toBe(true)
        expect(invalidResult.success).toBe(false)
      })

      it('should validate dayOfMonth is between 1-31', () => {
        // Arrange
        const validInput = {
          name: 'Monthly on 15th',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          dayOfMonth: 15,
          startDate: '2025-01-15T10:00:00Z',
        }

        const invalidInput = {
          ...validInput,
          dayOfMonth: 32,
        }

        // Act
        const validResult = createScheduleSchema.safeParse(validInput)
        const invalidResult = createScheduleSchema.safeParse(invalidInput)

        // Assert
        expect(validResult.success).toBe(true)
        expect(invalidResult.success).toBe(false)
      })

      it('should validate monthOfYear is between 1-12', () => {
        // Arrange
        const validInput = {
          name: 'Annual in June',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'annually',
          monthOfYear: 6,
          startDate: '2025-01-15T10:00:00Z',
        }

        const invalidInput = {
          ...validInput,
          monthOfYear: 13,
        }

        // Act
        const validResult = createScheduleSchema.safeParse(validInput)
        const invalidResult = createScheduleSchema.safeParse(invalidInput)

        // Assert
        expect(validResult.success).toBe(true)
        expect(invalidResult.success).toBe(false)
      })
    })

    describe('Threshold and lead time validation', () => {
      it('should validate thresholdAlertPercent is between 1-100', () => {
        // Arrange
        const validInput = {
          name: 'Mileage Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          thresholdAlertPercent: 90,
        }

        const invalidInput = {
          ...validInput,
          thresholdAlertPercent: 101,
        }

        // Act
        const validResult = createScheduleSchema.safeParse(validInput)
        const invalidResult = createScheduleSchema.safeParse(invalidInput)

        // Assert
        expect(validResult.success).toBe(true)
        expect(invalidResult.success).toBe(false)
      })

      it('should default thresholdAlertPercent to 90', () => {
        // Arrange
        const input = {
          name: 'Mileage Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.thresholdAlertPercent).toBe(90)
        }
      })

      it('should validate leadTimeDays is non-negative', () => {
        // Arrange
        const validInput = {
          name: 'Monthly Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
          leadTimeDays: 0,
        }

        const invalidInput = {
          ...validInput,
          leadTimeDays: -1,
        }

        // Act
        const validResult = createScheduleSchema.safeParse(validInput)
        const invalidResult = createScheduleSchema.safeParse(invalidInput)

        // Assert
        expect(validResult.success).toBe(true)
        expect(invalidResult.success).toBe(false)
      })

      it('should default leadTimeDays to 7', () => {
        // Arrange
        const input = {
          name: 'Monthly Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.leadTimeDays).toBe(7)
        }
      })
    })

    describe('Priority validation', () => {
      it('should accept low priority', () => {
        // Arrange
        const input = {
          name: 'Low Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          defaultPriority: 'low',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept medium priority', () => {
        // Arrange
        const input = {
          name: 'Medium Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          defaultPriority: 'medium',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept high priority', () => {
        // Arrange
        const input = {
          name: 'High Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          defaultPriority: 'high',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept critical priority', () => {
        // Arrange
        const input = {
          name: 'Critical Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          defaultPriority: 'critical',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should default priority to medium', () => {
        // Arrange
        const input = {
          name: 'Default Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.defaultPriority).toBe('medium')
        }
      })

      it('should reject invalid priority', () => {
        // Arrange
        const input = {
          name: 'Invalid Priority Service',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: 5000,
          defaultPriority: 'urgent',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('Interval value validation', () => {
      it('should require positive intervalValue', () => {
        // Arrange
        const input = {
          name: 'Invalid Interval',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'time_based',
          intervalType: 'monthly',
          intervalValue: 0,
          startDate: '2025-01-15T10:00:00Z',
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should require positive intervalMileage', () => {
        // Arrange
        const input = {
          name: 'Invalid Mileage',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalMileage: -100,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should require positive intervalHours', () => {
        // Arrange
        const input = {
          name: 'Invalid Hours',
          assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
          scheduleType: 'usage_based',
          intervalHours: 0,
        }

        // Act
        const result = createScheduleSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Approaching Threshold Calculations', () => {
    describe('calculateUsageStatus helper', () => {
      // This mirrors the logic from approaching-thresholds.get.ts
      function calculateUsageStatus(current: number, lastTriggered: number, interval: number) {
        const usedSinceLastTrigger = current - lastTriggered
        const nextTrigger = lastTriggered + interval
        const remaining = nextTrigger - current
        const progress = Math.round((usedSinceLastTrigger / interval) * 100)

        return {
          nextTrigger,
          remaining,
          progress,
        }
      }

      it('should calculate 50% progress correctly', () => {
        // Arrange
        const current = 7500
        const lastTriggered = 5000
        const interval = 5000

        // Act
        const result = calculateUsageStatus(current, lastTriggered, interval)

        // Assert
        expect(result.progress).toBe(50)
        expect(result.nextTrigger).toBe(10000)
        expect(result.remaining).toBe(2500)
      })

      it('should calculate 100% progress when exactly at trigger point', () => {
        // Arrange
        const current = 10000
        const lastTriggered = 5000
        const interval = 5000

        // Act
        const result = calculateUsageStatus(current, lastTriggered, interval)

        // Assert
        expect(result.progress).toBe(100)
        expect(result.remaining).toBe(0)
      })

      it('should calculate over 100% when overdue', () => {
        // Arrange
        const current = 12000
        const lastTriggered = 5000
        const interval = 5000

        // Act
        const result = calculateUsageStatus(current, lastTriggered, interval)

        // Assert
        expect(result.progress).toBe(140)
        expect(result.remaining).toBe(-2000)
      })

      it('should handle first trigger (lastTriggered = 0)', () => {
        // Arrange
        const current = 2500
        const lastTriggered = 0
        const interval = 5000

        // Act
        const result = calculateUsageStatus(current, lastTriggered, interval)

        // Assert
        expect(result.progress).toBe(50)
        expect(result.nextTrigger).toBe(5000)
        expect(result.remaining).toBe(2500)
      })
    })

    describe('Urgency level determination', () => {
      it('should return overdue for >= 100%', () => {
        // Arrange
        const mileageProgress = 110
        const hoursProgress = 80
        const maxProgress = Math.max(mileageProgress, hoursProgress)

        // Act
        let urgency: 'approaching' | 'due' | 'overdue'
        if (maxProgress >= 100) {
          urgency = 'overdue'
        } else if (maxProgress >= 95) {
          urgency = 'due'
        } else {
          urgency = 'approaching'
        }

        // Assert
        expect(urgency).toBe('overdue')
      })

      it('should return due for 95-99%', () => {
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

      it('should return approaching for < 95%', () => {
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

      it('should use max of mileage and hours progress', () => {
        // Arrange
        const mileageProgress = 85
        const hoursProgress = 97 // This is higher

        // Act
        const maxProgress = Math.max(mileageProgress, hoursProgress)
        let urgency: 'approaching' | 'due' | 'overdue'
        if (maxProgress >= 100) {
          urgency = 'overdue'
        } else if (maxProgress >= 95) {
          urgency = 'due'
        } else {
          urgency = 'approaching'
        }

        // Assert
        expect(maxProgress).toBe(97)
        expect(urgency).toBe('due')
      })
    })

    describe('Alert threshold detection', () => {
      it('should alert when progress >= threshold', () => {
        // Arrange
        const progress = 92
        const thresholdAlertPercent = 90

        // Act
        const shouldAlert = progress >= thresholdAlertPercent

        // Assert
        expect(shouldAlert).toBe(true)
      })

      it('should not alert when progress < threshold', () => {
        // Arrange
        const progress = 85
        const thresholdAlertPercent = 90

        // Act
        const shouldAlert = progress >= thresholdAlertPercent

        // Assert
        expect(shouldAlert).toBe(false)
      })

      it('should alert on exact threshold', () => {
        // Arrange
        const progress = 90
        const thresholdAlertPercent = 90

        // Act
        const shouldAlert = progress >= thresholdAlertPercent

        // Assert
        expect(shouldAlert).toBe(true)
      })

      it('should respect custom threshold', () => {
        // Arrange
        const progress = 82
        const thresholdAlertPercent = 80

        // Act
        const shouldAlert = progress >= thresholdAlertPercent

        // Assert
        expect(shouldAlert).toBe(true)
      })
    })
  })

  describe('Schedule Status Transitions', () => {
    it('should default isActive to true', () => {
      // Arrange
      const input = {
        name: 'New Schedule',
        assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
        scheduleType: 'usage_based',
        intervalMileage: 5000,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should accept isActive = false', () => {
      // Arrange
      const input = {
        name: 'Inactive Schedule',
        assetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
        scheduleType: 'usage_based',
        intervalMileage: 5000,
        isActive: false,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(false)
      }
    })
  })

  describe('Complete Schedule Scenarios', () => {
    // Valid UUID format for tests (v4 pattern)
    const validAssetId = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
    const validTemplateId = 'b2c3d4e5-f6a7-4901-bcde-f12345678901'
    const validAssigneeId = 'c3d4e5f6-a7b8-4012-9def-123456789012'
    const validCategoryId = 'd4e5f6a7-b8c9-4123-adef-234567890123'

    it('should validate a complete time-based weekly schedule', () => {
      // Arrange
      const input = {
        name: 'Weekly Safety Inspection',
        description: 'Check all safety equipment every Monday',
        assetId: validAssetId,
        templateId: validTemplateId,
        scheduleType: 'time_based',
        intervalType: 'weekly',
        intervalValue: 1,
        dayOfWeek: 1, // Monday
        startDate: '2025-01-06T08:00:00Z',
        leadTimeDays: 3,
        defaultPriority: 'high',
        defaultAssigneeId: validAssigneeId,
        isActive: true,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should validate a complete usage-based schedule', () => {
      // Arrange
      const input = {
        name: 'Oil Change Service',
        description: 'Change engine oil every 5000 km or 250 hours',
        assetId: validAssetId,
        scheduleType: 'usage_based',
        intervalMileage: 5000,
        intervalHours: 250,
        thresholdAlertPercent: 85,
        defaultPriority: 'medium',
        isActive: true,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should validate a complete combined schedule', () => {
      // Arrange
      const input = {
        name: 'Major Service',
        description: 'Full service every 3 months or 10000 km, whichever comes first',
        assetId: validAssetId,
        templateId: validTemplateId,
        scheduleType: 'combined',
        intervalType: 'quarterly',
        intervalValue: 1,
        dayOfMonth: 15,
        startDate: '2025-01-15T09:00:00Z',
        endDate: '2027-01-15T09:00:00Z',
        intervalMileage: 10000,
        thresholdAlertPercent: 90,
        leadTimeDays: 14,
        defaultPriority: 'high',
        defaultAssigneeId: validAssigneeId,
        isActive: true,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should validate a category-based schedule for all vehicles', () => {
      // Arrange
      const input = {
        name: 'Fleet-wide Annual Inspection',
        description: 'Annual safety inspection for all trucks',
        categoryId: validCategoryId,
        scheduleType: 'time_based',
        intervalType: 'annually',
        intervalValue: 1,
        monthOfYear: 3, // March
        dayOfMonth: 1,
        startDate: '2025-03-01T08:00:00Z',
        leadTimeDays: 30,
        defaultPriority: 'critical',
        isActive: true,
      }

      // Act
      const result = createScheduleSchema.safeParse(input)

      // Assert
      expect(result.success).toBe(true)
    })
  })
})
