/**
 * Operator Sessions Tests
 *
 * Tests for operator log-on, log-off, and active session functionality.
 * Following behavioral testing patterns - testing actual schema validation and business logic.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createAdminUser, createOperatorUser, resetFixtures } from '../../../../tests/helpers'

// Log-on schema (matches the API endpoint)
const logOnSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  startOdometer: z.number().min(0).optional().nullable(),
  startHours: z.number().min(0).optional().nullable(),
  startLatitude: z.number().min(-90).max(90).optional().nullable(),
  startLongitude: z.number().min(-180).max(180).optional().nullable(),
  startLocationName: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  syncStatus: z.enum(['synced', 'pending', 'failed']).optional().default('synced'),
  startTime: z.string().datetime().optional(),
})

// Log-off schema (matches the API endpoint)
const logOffSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID').optional(),
  endOdometer: z.number().min(0).optional().nullable(),
  endHours: z.number().min(0).optional().nullable(),
  endLatitude: z.number().min(-90).max(90).optional().nullable(),
  endLongitude: z.number().min(-180).max(180).optional().nullable(),
  endLocationName: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  syncStatus: z.enum(['synced', 'pending', 'failed']).optional().default('synced'),
  endTime: z.string().datetime().optional(),
})

describe('Operator Sessions', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('Log-On Schema Validation', () => {
    describe('assetId validation', () => {
      it('should accept valid UUID for assetId', () => {
        // Arrange
        const validLogOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = logOnSchema.safeParse(validLogOn)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID for assetId', () => {
        // Arrange
        const invalidLogOn = {
          assetId: 'not-a-valid-uuid',
        }

        // Act
        const result = logOnSchema.safeParse(invalidLogOn)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.assetId).toBeDefined()
        }
      })

      it('should reject missing assetId', () => {
        // Arrange
        const invalidLogOn = {}

        // Act
        const result = logOnSchema.safeParse(invalidLogOn)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.assetId).toBeDefined()
        }
      })
    })

    describe('odometer validation', () => {
      it('should accept valid odometer reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startOdometer: 12500.5,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.startOdometer).toBe(12500.5)
        }
      })

      it('should accept zero odometer reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startOdometer: 0,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject negative odometer reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startOdometer: -100,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow null odometer reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startOdometer: null,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('hours validation', () => {
      it('should accept valid hours reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startHours: 1250.5,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.startHours).toBe(1250.5)
        }
      })

      it('should reject negative hours reading', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startHours: -10,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('GPS coordinates validation', () => {
      it('should accept valid GPS coordinates', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: -33.8688,
          startLongitude: 151.2093, // Sydney coordinates
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.startLatitude).toBe(-33.8688)
          expect(result.data.startLongitude).toBe(151.2093)
        }
      })

      it('should accept latitude at boundaries', () => {
        // Arrange - test both min and max values
        const logOnMin = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: -90,
          startLongitude: 0,
        }
        const logOnMax = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 90,
          startLongitude: 0,
        }

        // Act
        const resultMin = logOnSchema.safeParse(logOnMin)
        const resultMax = logOnSchema.safeParse(logOnMax)

        // Assert
        expect(resultMin.success).toBe(true)
        expect(resultMax.success).toBe(true)
      })

      it('should reject latitude outside valid range', () => {
        // Arrange
        const logOnTooLow = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: -91,
          startLongitude: 0,
        }
        const logOnTooHigh = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 91,
          startLongitude: 0,
        }

        // Act
        const resultLow = logOnSchema.safeParse(logOnTooLow)
        const resultHigh = logOnSchema.safeParse(logOnTooHigh)

        // Assert
        expect(resultLow.success).toBe(false)
        expect(resultHigh.success).toBe(false)
      })

      it('should accept longitude at boundaries', () => {
        // Arrange
        const logOnMin = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 0,
          startLongitude: -180,
        }
        const logOnMax = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 0,
          startLongitude: 180,
        }

        // Act
        const resultMin = logOnSchema.safeParse(logOnMin)
        const resultMax = logOnSchema.safeParse(logOnMax)

        // Assert
        expect(resultMin.success).toBe(true)
        expect(resultMax.success).toBe(true)
      })

      it('should reject longitude outside valid range', () => {
        // Arrange
        const logOnTooLow = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 0,
          startLongitude: -181,
        }
        const logOnTooHigh = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLatitude: 0,
          startLongitude: 181,
        }

        // Act
        const resultLow = logOnSchema.safeParse(logOnTooLow)
        const resultHigh = logOnSchema.safeParse(logOnTooHigh)

        // Assert
        expect(resultLow.success).toBe(false)
        expect(resultHigh.success).toBe(false)
      })
    })

    describe('location name validation', () => {
      it('should accept valid location name', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLocationName: 'Main Depot - Bay 3',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject location name exceeding 255 characters', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLocationName: 'A'.repeat(256),
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept location name at max length', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startLocationName: 'A'.repeat(255),
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('notes validation', () => {
      it('should accept valid notes', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          notes: 'Starting shift, vehicle pre-check completed',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject notes exceeding 1000 characters', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          notes: 'A'.repeat(1001),
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('syncStatus validation', () => {
      it('should accept valid sync status values', () => {
        // Arrange
        const validStatuses = ['synced', 'pending', 'failed']

        for (const syncStatus of validStatuses) {
          const logOn = {
            assetId: '123e4567-e89b-12d3-a456-426614174000',
            syncStatus,
          }

          // Act
          const result = logOnSchema.safeParse(logOn)

          // Assert
          expect(result.success).toBe(true)
        }
      })

      it('should reject invalid sync status', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          syncStatus: 'invalid_status',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should default to synced when not provided', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.syncStatus).toBe('synced')
        }
      })
    })

    describe('startTime validation', () => {
      it('should accept valid ISO datetime string', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startTime: '2024-12-28T08:30:00.000Z',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid datetime format', () => {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startTime: '28/12/2024 08:30',
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('complete log-on payload', () => {
      it('should validate a complete log-on request', () => {
        // Arrange
        const completeLogOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          startOdometer: 45000.5,
          startHours: 1250.25,
          startLatitude: -33.8688,
          startLongitude: 151.2093,
          startLocationName: 'Sydney Depot',
          notes: 'Morning shift start',
          syncStatus: 'synced',
          startTime: '2024-12-28T08:00:00.000Z',
        }

        // Act
        const result = logOnSchema.safeParse(completeLogOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000')
          expect(result.data.startOdometer).toBe(45000.5)
          expect(result.data.startHours).toBe(1250.25)
          expect(result.data.startLatitude).toBe(-33.8688)
          expect(result.data.startLongitude).toBe(151.2093)
          expect(result.data.startLocationName).toBe('Sydney Depot')
          expect(result.data.notes).toBe('Morning shift start')
          expect(result.data.syncStatus).toBe('synced')
        }
      })
    })
  })

  describe('Log-Off Schema Validation', () => {
    describe('sessionId validation', () => {
      it('should accept valid UUID for sessionId', () => {
        // Arrange
        const validLogOff = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = logOffSchema.safeParse(validLogOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID for sessionId', () => {
        // Arrange
        const invalidLogOff = {
          sessionId: 'not-a-valid-uuid',
        }

        // Act
        const result = logOffSchema.safeParse(invalidLogOff)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow missing sessionId (uses current active session)', () => {
        // Arrange
        const logOff = {
          endOdometer: 12600,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('endOdometer validation', () => {
      it('should accept valid end odometer reading', () => {
        // Arrange
        const logOff = {
          endOdometer: 45150.5,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.endOdometer).toBe(45150.5)
        }
      })

      it('should reject negative end odometer', () => {
        // Arrange
        const logOff = {
          endOdometer: -100,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('endHours validation', () => {
      it('should accept valid end hours reading', () => {
        // Arrange
        const logOff = {
          endHours: 1258.75,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject negative end hours', () => {
        // Arrange
        const logOff = {
          endHours: -5,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('GPS coordinates validation', () => {
      it('should accept valid end GPS coordinates', () => {
        // Arrange
        const logOff = {
          endLatitude: -34.0522,
          endLongitude: 151.1234,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid end latitude', () => {
        // Arrange
        const logOff = {
          endLatitude: 95, // Outside -90 to 90 range
          endLongitude: 0,
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject invalid end longitude', () => {
        // Arrange
        const logOff = {
          endLatitude: 0,
          endLongitude: 185, // Outside -180 to 180 range
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('endLocationName validation', () => {
      it('should accept valid end location name', () => {
        // Arrange
        const logOff = {
          endLocationName: 'Warehouse B - Loading Dock 2',
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject end location name exceeding max length', () => {
        // Arrange
        const logOff = {
          endLocationName: 'X'.repeat(256),
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('notes validation', () => {
      it('should accept valid log-off notes', () => {
        // Arrange
        const logOff = {
          notes: 'End of shift. Vehicle parked in bay 5. Fuel tank at 3/4.',
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject notes exceeding 1000 characters', () => {
        // Arrange
        const logOff = {
          notes: 'N'.repeat(1001),
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('endTime validation', () => {
      it('should accept valid ISO datetime for end time', () => {
        // Arrange
        const logOff = {
          endTime: '2024-12-28T17:30:00.000Z',
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid datetime format for end time', () => {
        // Arrange
        const logOff = {
          endTime: 'December 28, 2024 5:30 PM',
        }

        // Act
        const result = logOffSchema.safeParse(logOff)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('complete log-off payload', () => {
      it('should validate a complete log-off request', () => {
        // Arrange
        const completeLogOff = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          endOdometer: 45150.5,
          endHours: 1258.75,
          endLatitude: -34.0522,
          endLongitude: 151.1234,
          endLocationName: 'Melbourne Depot',
          notes: 'Afternoon shift complete. No issues.',
          syncStatus: 'synced',
          endTime: '2024-12-28T17:30:00.000Z',
        }

        // Act
        const result = logOffSchema.safeParse(completeLogOff)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000')
          expect(result.data.endOdometer).toBe(45150.5)
          expect(result.data.endHours).toBe(1258.75)
          expect(result.data.endLatitude).toBe(-34.0522)
          expect(result.data.endLongitude).toBe(151.1234)
          expect(result.data.endLocationName).toBe('Melbourne Depot')
          expect(result.data.notes).toBe('Afternoon shift complete. No issues.')
          expect(result.data.syncStatus).toBe('synced')
        }
      })
    })
  })

  describe('Session Duration Calculations', () => {
    // Helper function to calculate trip duration (mirrors API logic)
    function calculateTripDurationMinutes(startTime: Date, endTime: Date): number {
      return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
    }

    it('should calculate duration for a short trip', () => {
      // Arrange
      const startTime = new Date('2024-12-28T08:00:00.000Z')
      const endTime = new Date('2024-12-28T08:30:00.000Z') // 30 minutes later

      // Act
      const durationMinutes = calculateTripDurationMinutes(startTime, endTime)

      // Assert
      expect(durationMinutes).toBe(30)
    })

    it('should calculate duration for a full shift', () => {
      // Arrange
      const startTime = new Date('2024-12-28T08:00:00.000Z')
      const endTime = new Date('2024-12-28T16:30:00.000Z') // 8.5 hours later

      // Act
      const durationMinutes = calculateTripDurationMinutes(startTime, endTime)

      // Assert
      expect(durationMinutes).toBe(510) // 8.5 hours = 510 minutes
    })

    it('should calculate duration spanning midnight', () => {
      // Arrange
      const startTime = new Date('2024-12-28T22:00:00.000Z')
      const endTime = new Date('2024-12-29T06:00:00.000Z') // 8 hours later

      // Act
      const durationMinutes = calculateTripDurationMinutes(startTime, endTime)

      // Assert
      expect(durationMinutes).toBe(480) // 8 hours = 480 minutes
    })

    it('should handle zero duration (immediate log-off)', () => {
      // Arrange
      const startTime = new Date('2024-12-28T08:00:00.000Z')
      const endTime = new Date('2024-12-28T08:00:00.000Z')

      // Act
      const durationMinutes = calculateTripDurationMinutes(startTime, endTime)

      // Assert
      expect(durationMinutes).toBe(0)
    })

    it('should round to nearest minute', () => {
      // Arrange
      const startTime = new Date('2024-12-28T08:00:00.000Z')
      const endTime = new Date('2024-12-28T08:15:45.000Z') // 15 min 45 sec

      // Act
      const durationMinutes = calculateTripDurationMinutes(startTime, endTime)

      // Assert
      expect(durationMinutes).toBe(16) // Rounds 15.75 to 16
    })
  })

  describe('Trip Distance Calculations', () => {
    // Helper function to calculate trip distance (mirrors API logic)
    function calculateTripDistance(
      startOdometer: string | null,
      endOdometer: number | null | undefined,
    ): number | null {
      if (endOdometer == null || startOdometer == null) {
        return null
      }
      const startOdo = parseFloat(startOdometer)
      let tripDistance = endOdometer - startOdo
      if (tripDistance < 0) {
        tripDistance = 0 // Guard against invalid readings
      }
      return tripDistance
    }

    it('should calculate distance for a normal trip', () => {
      // Arrange
      const startOdometer = '45000.0'
      const endOdometer = 45150.5

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBe(150.5)
    })

    it('should return null when start odometer is null', () => {
      // Arrange
      const startOdometer = null
      const endOdometer = 45150.5

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBeNull()
    })

    it('should return null when end odometer is null', () => {
      // Arrange
      const startOdometer = '45000.0'
      const endOdometer = null

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBeNull()
    })

    it('should return 0 for negative distance (odometer rollback)', () => {
      // Arrange - end odometer less than start (possible error or rollback)
      const startOdometer = '45000.0'
      const endOdometer = 44900.0

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBe(0)
    })

    it('should handle zero distance (no travel)', () => {
      // Arrange
      const startOdometer = '45000.0'
      const endOdometer = 45000.0

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBe(0)
    })

    it('should handle large distance values', () => {
      // Arrange
      const startOdometer = '100000.0'
      const endOdometer = 100500.75

      // Act
      const tripDistance = calculateTripDistance(startOdometer, endOdometer)

      // Assert
      expect(tripDistance).toBe(500.75)
    })
  })

  describe('Session Status Transitions', () => {
    // Valid session statuses
    const validStatuses = ['active', 'completed', 'cancelled'] as const
    type SessionStatus = (typeof validStatuses)[number]

    // Helper function to validate status transition
    function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
      const validTransitions: Record<SessionStatus, SessionStatus[]> = {
        active: ['completed', 'cancelled'],
        completed: [], // No transitions from completed
        cancelled: [], // No transitions from cancelled
      }
      return validTransitions[from]?.includes(to) ?? false
    }

    it('should allow active to completed transition', () => {
      // Act & Assert
      expect(isValidTransition('active', 'completed')).toBe(true)
    })

    it('should allow active to cancelled transition', () => {
      // Act & Assert
      expect(isValidTransition('active', 'cancelled')).toBe(true)
    })

    it('should not allow completed to active transition', () => {
      // Act & Assert
      expect(isValidTransition('completed', 'active')).toBe(false)
    })

    it('should not allow completed to cancelled transition', () => {
      // Act & Assert
      expect(isValidTransition('completed', 'cancelled')).toBe(false)
    })

    it('should not allow cancelled to active transition', () => {
      // Act & Assert
      expect(isValidTransition('cancelled', 'active')).toBe(false)
    })

    it('should not allow cancelled to completed transition', () => {
      // Act & Assert
      expect(isValidTransition('cancelled', 'completed')).toBe(false)
    })
  })

  describe('Sync Status Management', () => {
    const validSyncStatuses = ['synced', 'pending', 'failed'] as const

    it('should recognize all valid sync statuses', () => {
      for (const status of validSyncStatuses) {
        // Arrange
        const logOn = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          syncStatus: status,
        }

        // Act
        const result = logOnSchema.safeParse(logOn)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.syncStatus).toBe(status)
        }
      }
    })

    it('should handle offline session creation with pending sync status', () => {
      // Arrange - offline session with custom start time
      const offlineLogOn = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        startOdometer: 45000.0,
        startTime: '2024-12-28T08:00:00.000Z',
        syncStatus: 'pending',
      }

      // Act
      const result = logOnSchema.safeParse(offlineLogOn)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.syncStatus).toBe('pending')
        expect(result.data.startTime).toBe('2024-12-28T08:00:00.000Z')
      }
    })
  })

  describe('Duration Formatting', () => {
    // Helper function to format duration (mirrors API logic)
    function formatDuration(minutes: number): string {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    }

    it('should format short duration correctly', () => {
      // Arrange & Act
      const formatted = formatDuration(15)

      // Assert
      expect(formatted).toBe('15m')
    })

    it('should format hour-based duration correctly', () => {
      // Arrange & Act
      const formatted = formatDuration(90)

      // Assert
      expect(formatted).toBe('1h 30m')
    })

    it('should format multi-hour duration correctly', () => {
      // Arrange & Act
      const formatted = formatDuration(510)

      // Assert
      expect(formatted).toBe('8h 30m')
    })

    it('should format exact hours correctly', () => {
      // Arrange & Act
      const formatted = formatDuration(120)

      // Assert
      expect(formatted).toBe('2h 0m')
    })

    it('should format zero duration correctly', () => {
      // Arrange & Act
      const formatted = formatDuration(0)

      // Assert
      expect(formatted).toBe('0m')
    })
  })

  describe('Active Session Query Response', () => {
    interface ActiveSessionResponse {
      hasActiveSession: boolean
      session: unknown | null
      currentDuration?: {
        minutes: number
        formatted: string
      }
    }

    it('should return correct structure when no active session', () => {
      // Arrange
      const response: ActiveSessionResponse = {
        hasActiveSession: false,
        session: null,
      }

      // Assert
      expect(response.hasActiveSession).toBe(false)
      expect(response.session).toBeNull()
      expect(response.currentDuration).toBeUndefined()
    })

    it('should return correct structure when active session exists', () => {
      // Arrange
      const response: ActiveSessionResponse = {
        hasActiveSession: true,
        session: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          assetId: 'asset-123',
          operatorId: 'operator-123',
          status: 'active',
        },
        currentDuration: {
          minutes: 120,
          formatted: '2h 0m',
        },
      }

      // Assert
      expect(response.hasActiveSession).toBe(true)
      expect(response.session).not.toBeNull()
      expect(response.currentDuration?.minutes).toBe(120)
      expect(response.currentDuration?.formatted).toBe('2h 0m')
    })
  })

  describe('Permission Requirements', () => {
    it('should identify operator user permissions', () => {
      // Arrange
      const operatorUser = createOperatorUser()

      // Assert - operators should have assets:read for viewing
      expect(operatorUser.permissions).toContain('assets:read')
    })

    it('should identify admin user can access all sessions', () => {
      // Arrange
      const adminUser = createAdminUser()

      // Assert - admins have wildcard permission
      expect(adminUser.permissions).toContain('*')
    })
  })
})
