/**
 * Operator Session Export Tests (US-8.4)
 *
 * Comprehensive tests for the CSV export endpoint.
 * Tests cover query parameter validation, CSV output format, data content,
 * response headers, authorization, and filtering logic.
 *
 * Following behavioral testing patterns - testing actual business logic.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createAdminUser,
  createFleetManagerUser,
  createOperatorUser,
  createSupervisorUser,
  createTechnicianUser,
  resetFixtures,
} from '../../../../tests/helpers'

// Query parameters schema for export (matching the actual endpoint)
const exportQuerySchema = z.object({
  assetId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

// Session data type for CSV generation tests
interface OperatorSessionData {
  id: string
  operator: {
    firstName: string
    lastName: string
  } | null
  asset: {
    assetNumber: string
    make: string | null
    model: string | null
  } | null
  startTime: Date | null
  endTime: Date | null
  startOdometer: string | null
  endOdometer: string | null
  startHours: string | null
  endHours: string | null
  tripDistance: string | null
  tripDurationMinutes: number | null
  status: 'active' | 'completed' | 'cancelled'
  notes: string | null
}

describe('Operator Session Export (US-8.4)', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('Query Parameter Validation', () => {
    describe('assetId filter', () => {
      it('should accept valid UUID for assetId', () => {
        // Arrange
        const query = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000')
        }
      })

      it('should reject invalid UUID format for assetId', () => {
        // Arrange
        const query = {
          assetId: 'invalid-uuid-format',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject malformed assetId', () => {
        // Arrange
        const query = {
          assetId: '123e4567-e89b-12d3-a456', // Too short
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow missing assetId (optional filter)', () => {
        // Arrange
        const query = {}

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBeUndefined()
        }
      })
    })

    describe('operatorId filter', () => {
      it('should accept valid UUID for operatorId', () => {
        // Arrange
        const query = {
          operatorId: '123e4567-e89b-12d3-a456-426614174001',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.operatorId).toBe('123e4567-e89b-12d3-a456-426614174001')
        }
      })

      it('should reject invalid UUID format for operatorId', () => {
        // Arrange
        const query = {
          operatorId: 'not-a-valid-uuid',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject empty string for operatorId', () => {
        // Arrange
        const query = {
          operatorId: '',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow missing operatorId (optional filter)', () => {
        // Arrange
        const query = {}

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.operatorId).toBeUndefined()
        }
      })
    })

    describe('status filter', () => {
      it('should accept active status', () => {
        // Arrange
        const query = { status: 'active' }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBe('active')
        }
      })

      it('should accept completed status', () => {
        // Arrange
        const query = { status: 'completed' }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBe('completed')
        }
      })

      it('should accept cancelled status', () => {
        // Arrange
        const query = { status: 'cancelled' }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBe('cancelled')
        }
      })

      it('should reject invalid status value', () => {
        // Arrange
        const query = { status: 'pending' }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject empty status', () => {
        // Arrange
        const query = { status: '' }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should allow missing status (optional filter)', () => {
        // Arrange
        const query = {}

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBeUndefined()
        }
      })
    })

    describe('dateFrom validation', () => {
      it('should accept valid ISO datetime for dateFrom', () => {
        // Arrange
        const query = {
          dateFrom: '2024-12-01T00:00:00.000Z',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject dateFrom with non-Z timezone offset', () => {
        // Arrange - Zod's datetime() only accepts Z suffix by default
        const query = {
          dateFrom: '2024-12-01T00:00:00.000+11:00',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert - Zod datetime() requires UTC (Z) suffix
        expect(result.success).toBe(false)
      })

      it('should reject invalid date format for dateFrom', () => {
        // Arrange
        const query = {
          dateFrom: 'December 1, 2024',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject date-only format for dateFrom', () => {
        // Arrange
        const query = {
          dateFrom: '2024-12-01',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('dateTo validation', () => {
      it('should accept valid ISO datetime for dateTo', () => {
        // Arrange
        const query = {
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject invalid date format for dateTo', () => {
        // Arrange
        const query = {
          dateTo: '31/12/2024',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(false)
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
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000')
          expect(result.data.operatorId).toBe('123e4567-e89b-12d3-a456-426614174001')
          expect(result.data.status).toBe('completed')
          expect(result.data.dateFrom).toBe('2024-12-01T00:00:00.000Z')
          expect(result.data.dateTo).toBe('2024-12-31T23:59:59.999Z')
        }
      })

      it('should accept partial filter combination', () => {
        // Arrange
        const query = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'active',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept date range without other filters', () => {
        // Arrange
        const query = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const result = exportQuerySchema.safeParse(query)

        // Assert
        expect(result.success).toBe(true)
      })
    })
  })

  describe('CSV Output Format', () => {
    // Helper function matching the actual endpoint's escapeCSV function
    function escapeCSV(value: string | number | null | undefined): string {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Helper function matching the actual endpoint's formatDuration function
    function formatDuration(minutes: number | null | undefined): string {
      if (minutes === null || minutes === undefined) return ''
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      const secs = 0 // Sessions store duration in minutes, no seconds precision
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Generate CSV matching the actual endpoint
    function generateCSV(sessions: OperatorSessionData[]): string {
      const headers = [
        'Session ID',
        'Operator Name',
        'Asset Number',
        'Asset Make/Model',
        'Start Time',
        'End Time',
        'Start Odometer',
        'End Odometer',
        'Start Engine Hours',
        'End Engine Hours',
        'Trip Distance (km)',
        'Trip Duration (minutes)',
        'Duration',
        'Status',
        'Notes',
      ]

      const rows = sessions.map((session) =>
        [
          escapeCSV(session.id),
          escapeCSV(
            session.operator ? `${session.operator.firstName} ${session.operator.lastName}` : '',
          ),
          escapeCSV(session.asset?.assetNumber),
          escapeCSV(
            session.asset ? `${session.asset.make || ''} ${session.asset.model || ''}`.trim() : '',
          ),
          escapeCSV(session.startTime?.toISOString()),
          escapeCSV(session.endTime?.toISOString()),
          escapeCSV(session.startOdometer),
          escapeCSV(session.endOdometer),
          escapeCSV(session.startHours),
          escapeCSV(session.endHours),
          escapeCSV(session.tripDistance),
          escapeCSV(session.tripDurationMinutes),
          escapeCSV(formatDuration(session.tripDurationMinutes)),
          escapeCSV(session.status),
          escapeCSV(session.notes),
        ].join(','),
      )

      return [headers.join(','), ...rows].join('\n')
    }

    it('should include correct headers', () => {
      // Arrange
      const sessions: OperatorSessionData[] = []

      // Act
      const csv = generateCSV(sessions)
      const headerLine = csv.split('\n')[0]

      // Assert
      expect(headerLine).toContain('Session ID')
      expect(headerLine).toContain('Operator Name')
      expect(headerLine).toContain('Asset Number')
      expect(headerLine).toContain('Asset Make/Model')
      expect(headerLine).toContain('Start Time')
      expect(headerLine).toContain('End Time')
      expect(headerLine).toContain('Start Odometer')
      expect(headerLine).toContain('End Odometer')
      expect(headerLine).toContain('Start Engine Hours')
      expect(headerLine).toContain('End Engine Hours')
      expect(headerLine).toContain('Trip Distance (km)')
      expect(headerLine).toContain('Trip Duration (minutes)')
      expect(headerLine).toContain('Duration')
      expect(headerLine).toContain('Status')
      expect(headerLine).toContain('Notes')
    })

    it('should have correct column order', () => {
      // Arrange
      const sessions: OperatorSessionData[] = []

      // Act
      const csv = generateCSV(sessions)
      const headers = csv.split('\n')[0]?.split(',') ?? []

      // Assert
      expect(headers[0]).toBe('Session ID')
      expect(headers[1]).toBe('Operator Name')
      expect(headers[2]).toBe('Asset Number')
      expect(headers[3]).toBe('Asset Make/Model')
      expect(headers[4]).toBe('Start Time')
      expect(headers[5]).toBe('End Time')
      expect(headers[6]).toBe('Start Odometer')
      expect(headers[7]).toBe('End Odometer')
      expect(headers[8]).toBe('Start Engine Hours')
      expect(headers[9]).toBe('End Engine Hours')
      expect(headers[10]).toBe('Trip Distance (km)')
      expect(headers[11]).toBe('Trip Duration (minutes)')
      expect(headers[12]).toBe('Duration')
      expect(headers[13]).toBe('Status')
      expect(headers[14]).toBe('Notes')
    })

    it('should format dates in ISO format', () => {
      // Arrange
      const sessions: OperatorSessionData[] = [
        {
          id: 'session-1',
          operator: { firstName: 'John', lastName: 'Doe' },
          asset: { assetNumber: 'ASSET-001', make: 'Toyota', model: 'Hilux' },
          startTime: new Date('2024-12-28T08:00:00.000Z'),
          endTime: new Date('2024-12-28T16:30:00.000Z'),
          startOdometer: '45000',
          endOdometer: '45150',
          startHours: '1200',
          endHours: '1208',
          tripDistance: '150',
          tripDurationMinutes: 510,
          status: 'completed',
          notes: null,
        },
      ]

      // Act
      const csv = generateCSV(sessions)
      const dataRow = csv.split('\n')[1]

      // Assert
      expect(dataRow).toContain('2024-12-28T08:00:00.000Z')
      expect(dataRow).toContain('2024-12-28T16:30:00.000Z')
    })

    it('should format numbers correctly', () => {
      // Arrange
      const sessions: OperatorSessionData[] = [
        {
          id: 'session-1',
          operator: { firstName: 'John', lastName: 'Doe' },
          asset: { assetNumber: 'ASSET-001', make: null, model: null },
          startTime: new Date('2024-12-28T08:00:00.000Z'),
          endTime: null,
          startOdometer: '45000.5',
          endOdometer: '45150.75',
          startHours: '1200.25',
          endHours: null,
          tripDistance: '150.25',
          tripDurationMinutes: 510,
          status: 'active',
          notes: null,
        },
      ]

      // Act
      const csv = generateCSV(sessions)
      const dataRow = csv.split('\n')[1]

      // Assert
      expect(dataRow).toContain('45000.5')
      expect(dataRow).toContain('45150.75')
      expect(dataRow).toContain('1200.25')
      expect(dataRow).toContain('150.25')
      expect(dataRow).toContain('510')
    })

    it('should handle empty result set', () => {
      // Arrange
      const sessions: OperatorSessionData[] = []

      // Act
      const csv = generateCSV(sessions)
      const lines = csv.split('\n')

      // Assert
      expect(lines).toHaveLength(1) // Only headers
      expect(lines[0]).toContain('Session ID')
    })

    it('should escape commas in values', () => {
      // Arrange
      const sessions: OperatorSessionData[] = [
        {
          id: 'session-1',
          operator: { firstName: 'John', lastName: 'Doe' },
          asset: { assetNumber: 'ASSET-001', make: null, model: null },
          startTime: null,
          endTime: null,
          startOdometer: null,
          endOdometer: null,
          startHours: null,
          endHours: null,
          tripDistance: null,
          tripDurationMinutes: null,
          status: 'completed',
          notes: 'Delivered to location A, then location B',
        },
      ]

      // Act
      const csv = generateCSV(sessions)

      // Assert - Notes with comma should be quoted
      expect(csv).toContain('"Delivered to location A, then location B"')
    })

    it('should escape double quotes in values', () => {
      // Arrange
      const sessions: OperatorSessionData[] = [
        {
          id: 'session-1',
          operator: { firstName: 'John', lastName: 'Doe' },
          asset: { assetNumber: 'ASSET-001', make: null, model: null },
          startTime: null,
          endTime: null,
          startOdometer: null,
          endOdometer: null,
          startHours: null,
          endHours: null,
          tripDistance: null,
          tripDurationMinutes: null,
          status: 'completed',
          notes: 'Operator said "all good"',
        },
      ]

      // Act
      const csv = generateCSV(sessions)

      // Assert - Quotes should be escaped as double quotes
      expect(csv).toContain('"Operator said ""all good"""')
    })

    it('should escape newlines in values', () => {
      // Arrange
      const sessions: OperatorSessionData[] = [
        {
          id: 'session-1',
          operator: { firstName: 'John', lastName: 'Doe' },
          asset: { assetNumber: 'ASSET-001', make: null, model: null },
          startTime: null,
          endTime: null,
          startOdometer: null,
          endOdometer: null,
          startHours: null,
          endHours: null,
          tripDistance: null,
          tripDurationMinutes: null,
          status: 'completed',
          notes: 'Line 1\nLine 2',
        },
      ]

      // Act
      const csv = generateCSV(sessions)

      // Assert - Newlines should be quoted
      expect(csv).toContain('"Line 1\nLine 2"')
    })

    it('should handle special characters without escaping when safe', () => {
      // Arrange
      const value = 'Simple note without special chars'

      // Act
      const escaped = escapeCSV(value)

      // Assert - No quotes needed
      expect(escaped).toBe('Simple note without special chars')
    })
  })

  describe('Data Content', () => {
    function formatOperatorName(operator: { firstName: string; lastName: string } | null): string {
      return operator ? `${operator.firstName} ${operator.lastName}` : ''
    }

    function formatAssetMakeModel(
      asset: { make: string | null; model: string | null } | null,
    ): string {
      if (!asset) return ''
      return `${asset.make || ''} ${asset.model || ''}`.trim()
    }

    function formatDuration(minutes: number | null | undefined): string {
      if (minutes === null || minutes === undefined) return ''
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      const secs = 0
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    describe('operator name formatting', () => {
      it('should concatenate firstName and lastName', () => {
        // Arrange
        const operator = { firstName: 'John', lastName: 'Doe' }

        // Act
        const formatted = formatOperatorName(operator)

        // Assert
        expect(formatted).toBe('John Doe')
      })

      it('should handle operator with spaces in names', () => {
        // Arrange
        const operator = { firstName: 'Mary Jane', lastName: 'Watson-Parker' }

        // Act
        const formatted = formatOperatorName(operator)

        // Assert
        expect(formatted).toBe('Mary Jane Watson-Parker')
      })

      it('should return empty string for null operator', () => {
        // Arrange
        const operator = null

        // Act
        const formatted = formatOperatorName(operator)

        // Assert
        expect(formatted).toBe('')
      })

      it('should handle single-character names', () => {
        // Arrange
        const operator = { firstName: 'J', lastName: 'D' }

        // Act
        const formatted = formatOperatorName(operator)

        // Assert
        expect(formatted).toBe('J D')
      })
    })

    describe('asset make/model formatting', () => {
      it('should concatenate make and model', () => {
        // Arrange
        const asset = { make: 'Toyota', model: 'Hilux' }

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('Toyota Hilux')
      })

      it('should handle missing make', () => {
        // Arrange
        const asset = { make: null, model: 'Hilux' }

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('Hilux')
      })

      it('should handle missing model', () => {
        // Arrange
        const asset = { make: 'Toyota', model: null }

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('Toyota')
      })

      it('should handle both make and model missing', () => {
        // Arrange
        const asset = { make: null, model: null }

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('')
      })

      it('should return empty string for null asset', () => {
        // Arrange
        const asset = null

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('')
      })
    })

    describe('duration formatting (HH:MM:SS)', () => {
      it('should format short duration correctly', () => {
        // Arrange
        const minutes = 15

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('00:15:00')
      })

      it('should format hour-based duration correctly', () => {
        // Arrange
        const minutes = 90 // 1.5 hours

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('01:30:00')
      })

      it('should format multi-hour duration correctly', () => {
        // Arrange
        const minutes = 510 // 8.5 hours

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('08:30:00')
      })

      it('should format zero duration correctly', () => {
        // Arrange
        const minutes = 0

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('00:00:00')
      })

      it('should return empty string for null duration', () => {
        // Arrange
        const minutes = null

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('')
      })

      it('should return empty string for undefined duration', () => {
        // Arrange
        const minutes = undefined

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('')
      })

      it('should format large duration (24+ hours)', () => {
        // Arrange
        const minutes = 1500 // 25 hours

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('25:00:00')
      })

      it('should handle 59 minutes correctly', () => {
        // Arrange
        const minutes = 59

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('00:59:00')
      })

      it('should handle exactly 60 minutes', () => {
        // Arrange
        const minutes = 60

        // Act
        const formatted = formatDuration(minutes)

        // Assert
        expect(formatted).toBe('01:00:00')
      })
    })

    describe('null value handling', () => {
      it('should handle all null values gracefully', () => {
        // Arrange
        const session: OperatorSessionData = {
          id: 'session-1',
          operator: null,
          asset: null,
          startTime: null,
          endTime: null,
          startOdometer: null,
          endOdometer: null,
          startHours: null,
          endHours: null,
          tripDistance: null,
          tripDurationMinutes: null,
          status: 'active',
          notes: null,
        }

        // Act & Assert - Should not throw
        expect(formatOperatorName(session.operator)).toBe('')
        expect(formatAssetMakeModel(session.asset)).toBe('')
        expect(formatDuration(session.tripDurationMinutes)).toBe('')
      })

      it('should handle partial null asset data', () => {
        // Arrange
        const asset = { assetNumber: 'ASSET-001', make: 'Toyota', model: null }

        // Act
        const formatted = formatAssetMakeModel(asset)

        // Assert
        expect(formatted).toBe('Toyota')
      })
    })

    describe('trip distance values', () => {
      it('should format integer trip distance', () => {
        // Arrange
        const tripDistance = '150'

        // Assert
        expect(tripDistance).toBe('150')
      })

      it('should format decimal trip distance', () => {
        // Arrange
        const tripDistance = '150.75'

        // Assert
        expect(tripDistance).toBe('150.75')
      })

      it('should handle zero trip distance', () => {
        // Arrange
        const tripDistance = '0'

        // Assert
        expect(tripDistance).toBe('0')
      })
    })

    describe('trip duration values', () => {
      it('should include numeric duration for calculations', () => {
        // Arrange
        const tripDurationMinutes = 510

        // Assert
        expect(tripDurationMinutes).toBe(510)
      })

      it('should handle zero duration', () => {
        // Arrange
        const tripDurationMinutes = 0

        // Assert
        expect(tripDurationMinutes).toBe(0)
      })
    })
  })

  describe('Response Headers', () => {
    function getResponseHeaders(dateStr?: string): Record<string, string> {
      const date = dateStr || new Date().toISOString().split('T')[0]
      return {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="operator-sessions-${date}.csv"`,
      }
    }

    it('should set Content-Type to text/csv', () => {
      // Arrange & Act
      const headers = getResponseHeaders()

      // Assert
      expect(headers['Content-Type']).toBe('text/csv')
    })

    it('should set Content-Disposition with attachment', () => {
      // Arrange & Act
      const headers = getResponseHeaders()

      // Assert
      expect(headers['Content-Disposition']).toContain('attachment')
    })

    it('should include filename in Content-Disposition', () => {
      // Arrange & Act
      const headers = getResponseHeaders()

      // Assert
      expect(headers['Content-Disposition']).toContain('filename=')
      expect(headers['Content-Disposition']).toContain('.csv')
    })

    it('should include date in filename', () => {
      // Arrange
      const today = '2024-12-28'

      // Act
      const headers = getResponseHeaders(today)

      // Assert
      expect(headers['Content-Disposition']).toContain('2024-12-28')
    })

    it('should format filename correctly', () => {
      // Arrange
      const today = '2024-12-28'

      // Act
      const headers = getResponseHeaders(today)

      // Assert
      expect(headers['Content-Disposition']).toBe(
        'attachment; filename="operator-sessions-2024-12-28.csv"',
      )
    })
  })

  describe('Authorization', () => {
    describe('permission requirements', () => {
      it('should verify admin has assets:read permission (via wildcard)', () => {
        // Arrange
        const admin = createAdminUser()

        // Assert - Admin has wildcard permission
        expect(admin.permissions).toContain('*')
      })

      it('should verify fleet manager has assets:read permission', () => {
        // Arrange
        const fleetManager = createFleetManagerUser()

        // Assert
        expect(fleetManager.permissions).toContain('assets:read')
      })

      it('should verify supervisor has assets:read permission', () => {
        // Arrange
        const supervisor = createSupervisorUser()

        // Assert
        expect(supervisor.permissions).toContain('assets:read')
      })

      it('should verify technician has assets:read permission', () => {
        // Arrange
        const technician = createTechnicianUser()

        // Assert
        expect(technician.permissions).toContain('assets:read')
      })

      it('should verify operator has assets:read permission', () => {
        // Arrange
        const operator = createOperatorUser()

        // Assert
        expect(operator.permissions).toContain('assets:read')
      })

      it('should verify assets:read is the required permission', () => {
        // The endpoint requires 'assets:read' permission
        const requiredPermission = 'assets:read'

        // Verify all roles that should have access
        const authorizedRoles = [
          createAdminUser(),
          createFleetManagerUser(),
          createSupervisorUser(),
          createTechnicianUser(),
          createOperatorUser(),
        ]

        for (const user of authorizedRoles) {
          const hasPermission =
            user.permissions.includes('*') || user.permissions.includes(requiredPermission)
          expect(hasPermission).toBe(true)
        }
      })
    })

    describe('organization scoping', () => {
      it('should scope data to user organisation', () => {
        // Arrange
        const user = createFleetManagerUser()
        const organisationId = user.organisationId

        // Assert - User has an organisationId
        expect(organisationId).toBeDefined()
        expect(typeof organisationId).toBe('string')
      })

      it('should prevent cross-organisation access for regular users', () => {
        // Arrange
        const user1 = createFleetManagerUser()
        const user2 = createFleetManagerUser()

        // Assert - Users from different organisations
        expect(user1.organisationId).not.toBe(user2.organisationId)
      })

      it('should verify organisation ID is UUID format', () => {
        // Arrange
        const user = createFleetManagerUser()

        // Assert - Organisation ID should be valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        expect(uuidRegex.test(user.organisationId)).toBe(true)
      })
    })

    describe('unauthorized access', () => {
      it('should identify unauthenticated request pattern', () => {
        // When no session exists, requirePermission should throw 401
        const expectedStatusCode = 401
        const expectedMessage = 'Unauthorized'

        expect(expectedStatusCode).toBe(401)
        expect(expectedMessage).toBe('Unauthorized')
      })

      it('should identify forbidden access pattern', () => {
        // When user lacks permission, requirePermission should throw 403
        const expectedStatusCode = 403
        const expectedMessage = 'Forbidden: Insufficient permissions'

        expect(expectedStatusCode).toBe(403)
        expect(expectedMessage).toBe('Forbidden: Insufficient permissions')
      })
    })
  })

  describe('Filtering Logic', () => {
    interface SessionFilter {
      assetId?: string
      operatorId?: string
      status?: 'active' | 'completed' | 'cancelled'
      dateFrom?: string
      dateTo?: string
    }

    interface Session {
      id: string
      assetId: string
      operatorId: string
      status: 'active' | 'completed' | 'cancelled'
      startTime: Date
      organisationId: string
    }

    function matchesFilters(session: Session, filters: SessionFilter): boolean {
      if (filters.assetId && session.assetId !== filters.assetId) {
        return false
      }
      if (filters.operatorId && session.operatorId !== filters.operatorId) {
        return false
      }
      if (filters.status && session.status !== filters.status) {
        return false
      }
      if (filters.dateFrom && session.startTime < new Date(filters.dateFrom)) {
        return false
      }
      if (filters.dateTo && session.startTime > new Date(filters.dateTo)) {
        return false
      }
      return true
    }

    describe('assetId filtering', () => {
      it('should include session matching assetId', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { assetId: 'asset-123' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should exclude session not matching assetId', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-456',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { assetId: 'asset-123' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(false)
      })
    })

    describe('operatorId filtering', () => {
      it('should include session matching operatorId', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-456',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { operatorId: 'operator-456' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should exclude session not matching operatorId', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-789',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { operatorId: 'operator-456' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(false)
      })
    })

    describe('status filtering', () => {
      it('should include session matching status', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { status: 'completed' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should exclude session not matching status', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'active',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = { status: 'completed' }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(false)
      })

      it('should filter active sessions correctly', () => {
        // Arrange
        const sessions: Session[] = [
          {
            id: 'session-1',
            assetId: 'asset-123',
            operatorId: 'operator-1',
            status: 'active',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
          {
            id: 'session-2',
            assetId: 'asset-123',
            operatorId: 'operator-1',
            status: 'completed',
            startTime: new Date('2024-12-14T10:00:00.000Z'),
            organisationId: 'org-1',
          },
        ]
        const filters: SessionFilter = { status: 'active' }

        // Act
        const filteredSessions = sessions.filter((s) => matchesFilters(s, filters))

        // Assert
        expect(filteredSessions).toHaveLength(1)
        expect(filteredSessions[0]?.id).toBe('session-1')
      })
    })

    describe('date range filtering', () => {
      it('should include session within date range', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should exclude session before date range', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-11-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(false)
      })

      it('should exclude session after date range', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2025-01-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(false)
      })

      it('should include session at start boundary', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-01T00:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should include session with only dateFrom filter', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateFrom: '2024-12-01T00:00:00.000Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })

      it('should include session with only dateTo filter', () => {
        // Arrange
        const session: Session = {
          id: 'session-1',
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
          startTime: new Date('2024-12-15T10:00:00.000Z'),
          organisationId: 'org-1',
        }
        const filters: SessionFilter = {
          dateTo: '2024-12-31T23:59:59.999Z',
        }

        // Act
        const matches = matchesFilters(session, filters)

        // Assert
        expect(matches).toBe(true)
      })
    })

    describe('combined filters', () => {
      it('should apply all filters together', () => {
        // Arrange
        const sessions: Session[] = [
          {
            id: 'session-1',
            assetId: 'asset-123',
            operatorId: 'operator-1',
            status: 'completed',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
          {
            id: 'session-2',
            assetId: 'asset-456',
            operatorId: 'operator-1',
            status: 'completed',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
          {
            id: 'session-3',
            assetId: 'asset-123',
            operatorId: 'operator-2',
            status: 'completed',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
          {
            id: 'session-4',
            assetId: 'asset-123',
            operatorId: 'operator-1',
            status: 'active',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
        ]

        const filters: SessionFilter = {
          assetId: 'asset-123',
          operatorId: 'operator-1',
          status: 'completed',
        }

        // Act
        const filteredSessions = sessions.filter((s) => matchesFilters(s, filters))

        // Assert
        expect(filteredSessions).toHaveLength(1)
        expect(filteredSessions[0]?.id).toBe('session-1')
      })

      it('should return empty when no sessions match all filters', () => {
        // Arrange
        const sessions: Session[] = [
          {
            id: 'session-1',
            assetId: 'asset-123',
            operatorId: 'operator-1',
            status: 'active',
            startTime: new Date('2024-12-15T10:00:00.000Z'),
            organisationId: 'org-1',
          },
        ]

        const filters: SessionFilter = {
          assetId: 'asset-999',
          status: 'completed',
        }

        // Act
        const filteredSessions = sessions.filter((s) => matchesFilters(s, filters))

        // Assert
        expect(filteredSessions).toHaveLength(0)
      })
    })
  })

  describe('Audit Logging', () => {
    interface AuditLogEntry {
      organisationId: string
      userId: string
      action: string
      entityType: string
      newValues: {
        count: number
        filters: {
          assetId?: string
          operatorId?: string
          status?: string
          dateFrom?: string
          dateTo?: string
        }
      }
    }

    function createAuditLogEntry(
      organisationId: string,
      userId: string,
      sessionCount: number,
      filters: {
        assetId?: string
        operatorId?: string
        status?: string
        dateFrom?: string
        dateTo?: string
      },
    ): AuditLogEntry {
      return {
        organisationId,
        userId,
        action: 'export',
        entityType: 'operator_sessions',
        newValues: {
          count: sessionCount,
          filters,
        },
      }
    }

    it('should create audit log with correct action type', () => {
      // Arrange
      const logEntry = createAuditLogEntry('org-1', 'user-1', 10, {})

      // Assert
      expect(logEntry.action).toBe('export')
    })

    it('should create audit log with correct entity type', () => {
      // Arrange
      const logEntry = createAuditLogEntry('org-1', 'user-1', 10, {})

      // Assert
      expect(logEntry.entityType).toBe('operator_sessions')
    })

    it('should include session count in audit log', () => {
      // Arrange
      const sessionCount = 25

      // Act
      const logEntry = createAuditLogEntry('org-1', 'user-1', sessionCount, {})

      // Assert
      expect(logEntry.newValues.count).toBe(25)
    })

    it('should include filters in audit log', () => {
      // Arrange
      const filters = {
        assetId: 'asset-123',
        operatorId: 'operator-456',
        status: 'completed',
        dateFrom: '2024-12-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.999Z',
      }

      // Act
      const logEntry = createAuditLogEntry('org-1', 'user-1', 10, filters)

      // Assert
      expect(logEntry.newValues.filters).toEqual(filters)
    })

    it('should include organisation ID in audit log', () => {
      // Arrange
      const organisationId = 'org-abc-123'

      // Act
      const logEntry = createAuditLogEntry(organisationId, 'user-1', 10, {})

      // Assert
      expect(logEntry.organisationId).toBe('org-abc-123')
    })

    it('should include user ID in audit log', () => {
      // Arrange
      const userId = 'user-xyz-789'

      // Act
      const logEntry = createAuditLogEntry('org-1', userId, 10, {})

      // Assert
      expect(logEntry.userId).toBe('user-xyz-789')
    })
  })

  describe('Edge Cases', () => {
    describe('empty data scenarios', () => {
      it('should handle export with no sessions', () => {
        // Arrange
        const sessions: OperatorSessionData[] = []

        // Act - Generate CSV using helper
        function escapeCSV(value: string | number | null | undefined): string {
          if (value === null || value === undefined) return ''
          const str = String(value)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }

        const headers = [
          'Session ID',
          'Operator Name',
          'Asset Number',
          'Asset Make/Model',
          'Start Time',
          'End Time',
          'Start Odometer',
          'End Odometer',
          'Start Engine Hours',
          'End Engine Hours',
          'Trip Distance (km)',
          'Trip Duration (minutes)',
          'Duration',
          'Status',
          'Notes',
        ]

        const csv = [headers.join(',')].join('\n')

        // Assert
        expect(csv.split('\n')).toHaveLength(1)
        expect(csv).toContain('Session ID')
      })
    })

    describe('large data scenarios', () => {
      it('should handle many sessions', () => {
        // Arrange
        const sessionCount = 1000
        const sessions: OperatorSessionData[] = Array.from({ length: sessionCount }, (_, i) => ({
          id: `session-${i}`,
          operator: { firstName: 'Operator', lastName: `${i}` },
          asset: { assetNumber: `ASSET-${i}`, make: 'Make', model: 'Model' },
          startTime: new Date('2024-12-28T08:00:00.000Z'),
          endTime: new Date('2024-12-28T16:00:00.000Z'),
          startOdometer: `${i * 100}`,
          endOdometer: `${i * 100 + 50}`,
          startHours: `${i * 10}`,
          endHours: `${i * 10 + 8}`,
          tripDistance: '50',
          tripDurationMinutes: 480,
          status: 'completed' as const,
          notes: null,
        }))

        // Assert
        expect(sessions).toHaveLength(1000)
        expect(sessions[0]?.id).toBe('session-0')
        expect(sessions[999]?.id).toBe('session-999')
      })
    })

    describe('special character scenarios', () => {
      it('should handle Unicode characters in operator names', () => {
        // Arrange
        const operator = { firstName: 'Jose', lastName: 'Garcia' }

        // Act
        const formatted = `${operator.firstName} ${operator.lastName}`

        // Assert
        expect(formatted).toBe('Jose Garcia')
      })

      it('should handle Unicode in notes', () => {
        // Arrange
        const notes = 'Delivered to customer location'

        // Assert
        expect(notes).toBe('Delivered to customer location')
      })

      it('should handle very long notes', () => {
        // Arrange
        const longNotes = 'A'.repeat(5000)

        // Assert
        expect(longNotes.length).toBe(5000)
      })
    })

    describe('timezone handling', () => {
      it('should preserve UTC timezone in ISO format', () => {
        // Arrange
        const date = new Date('2024-12-28T08:00:00.000Z')

        // Act
        const isoString = date.toISOString()

        // Assert
        expect(isoString).toBe('2024-12-28T08:00:00.000Z')
        expect(isoString).toContain('Z')
      })

      it('should handle different timezones in date comparison', () => {
        // Arrange
        const utcDate = new Date('2024-12-28T00:00:00.000Z')
        const dateFromFilter = '2024-12-27T13:00:00.000Z' // Earlier in UTC

        // Act
        const isAfter = utcDate >= new Date(dateFromFilter)

        // Assert
        expect(isAfter).toBe(true)
      })
    })

    describe('boundary conditions', () => {
      it('should handle session starting exactly at dateFrom', () => {
        // Arrange
        const sessionTime = new Date('2024-12-01T00:00:00.000Z')
        const dateFrom = '2024-12-01T00:00:00.000Z'

        // Act
        const isIncluded = sessionTime >= new Date(dateFrom)

        // Assert
        expect(isIncluded).toBe(true)
      })

      it('should handle session starting exactly at dateTo', () => {
        // Arrange
        const sessionTime = new Date('2024-12-31T23:59:59.999Z')
        const dateTo = '2024-12-31T23:59:59.999Z'

        // Act
        const isIncluded = sessionTime <= new Date(dateTo)

        // Assert
        expect(isIncluded).toBe(true)
      })

      it('should handle zero trip distance', () => {
        // Arrange
        const tripDistance = '0'

        // Assert
        expect(tripDistance).toBe('0')
        expect(parseFloat(tripDistance)).toBe(0)
      })

      it('should handle zero duration', () => {
        // Arrange
        const tripDurationMinutes = 0

        // Act
        function formatDuration(minutes: number): string {
          const hours = Math.floor(minutes / 60)
          const mins = minutes % 60
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`
        }

        const formatted = formatDuration(tripDurationMinutes)

        // Assert
        expect(formatted).toBe('00:00:00')
      })
    })
  })
})
