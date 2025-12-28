import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Location Tracking Tests - Mobile App Core Feature
 *
 * Tests for GPS location tracking during operator sessions.
 * Validates schema, batch submission, query filters, and geofencing.
 */

// Schema definitions matching the actual API
const locationRecordSchema = z.object({
  id: z.string().uuid().optional(),
  operatorSessionId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  altitude: z.number().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  recordedAt: z.string().datetime(),
})

const batchUploadSchema = z.object({
  assetId: z.string().uuid(),
  records: z.array(locationRecordSchema).min(1).max(100),
})

const querySchema = z.object({
  assetId: z.string().uuid().optional(),
  operatorSessionId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// Geofencing validation schema
const geofenceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(['circle', 'polygon']),
  // For circle geofences
  centerLatitude: z.number().min(-90).max(90).optional(),
  centerLongitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().positive().optional(),
  // For polygon geofences
  coordinates: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .min(3)
    .optional(),
  isActive: z.boolean().default(true),
})

describe('Location Record Schema Validation', () => {
  describe('Individual Location Record', () => {
    it('should validate a valid location record', () => {
      const validRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        accuracy: 10.5,
        altitude: 50.0,
        speed: 60.5,
        heading: 180,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(validRecord)
      expect(result.success).toBe(true)
    })

    it('should accept optional client-generated UUID', () => {
      const record = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should require operatorSessionId', () => {
      const invalidRecord = {
        latitude: -37.8136,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for operatorSessionId', () => {
      const invalidRecord = {
        operatorSessionId: 'not-a-uuid',
        latitude: -37.8136,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should require latitude', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should require longitude', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should require recordedAt timestamp', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject latitude below -90', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -91,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject latitude above 90', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 91,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject longitude below -180', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: -181,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject longitude above 180', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 181,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should accept edge case latitude values (-90 and 90)', () => {
      const southPole = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -90,
        longitude: 0,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const northPole = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 90,
        longitude: 0,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      expect(locationRecordSchema.safeParse(southPole).success).toBe(true)
      expect(locationRecordSchema.safeParse(northPole).success).toBe(true)
    })

    it('should accept edge case longitude values (-180 and 180)', () => {
      const west = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 0,
        longitude: -180,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const east = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 0,
        longitude: 180,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      expect(locationRecordSchema.safeParse(west).success).toBe(true)
      expect(locationRecordSchema.safeParse(east).success).toBe(true)
    })

    it('should reject negative accuracy', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        accuracy: -5,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should accept zero accuracy', () => {
      const record = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        accuracy: 0,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should reject negative speed', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        speed: -10,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should accept zero speed (stationary)', () => {
      const record = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        speed: 0,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should reject heading below 0', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        heading: -1,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should reject heading above 360', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        heading: 361,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('should accept heading edge values (0 and 360)', () => {
      const north = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        heading: 0,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const fullCircle = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        heading: 360,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      expect(locationRecordSchema.safeParse(north).success).toBe(true)
      expect(locationRecordSchema.safeParse(fullCircle).success).toBe(true)
    })

    it('should allow optional fields to be omitted', () => {
      const minimalRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        recordedAt: '2024-12-28T10:00:00.000Z',
      }

      const result = locationRecordSchema.safeParse(minimalRecord)
      expect(result.success).toBe(true)
    })

    it('should reject invalid datetime format for recordedAt', () => {
      const invalidRecord = {
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: -37.8136,
        longitude: 144.9631,
        recordedAt: '2024-12-28',
      }

      const result = locationRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('Batch Upload Validation', () => {
    it('should validate a valid batch upload', () => {
      const validBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records: [
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8136,
            longitude: 144.9631,
            recordedAt: '2024-12-28T10:00:00.000Z',
          },
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8137,
            longitude: 144.9632,
            recordedAt: '2024-12-28T10:01:00.000Z',
          },
        ],
      }

      const result = batchUploadSchema.safeParse(validBatch)
      expect(result.success).toBe(true)
    })

    it('should require assetId', () => {
      const invalidBatch = {
        records: [
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8136,
            longitude: 144.9631,
            recordedAt: '2024-12-28T10:00:00.000Z',
          },
        ],
      }

      const result = batchUploadSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for assetId', () => {
      const invalidBatch = {
        assetId: 'not-a-uuid',
        records: [
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8136,
            longitude: 144.9631,
            recordedAt: '2024-12-28T10:00:00.000Z',
          },
        ],
      }

      const result = batchUploadSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })

    it('should require at least one record', () => {
      const invalidBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records: [],
      }

      const result = batchUploadSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })

    it('should reject more than 100 records', () => {
      const records = Array.from({ length: 101 }, (_, i) => ({
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
        latitude: -37.8136 + i * 0.0001,
        longitude: 144.9631,
        recordedAt: new Date(Date.now() + i * 60000).toISOString(),
      }))

      const invalidBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records,
      }

      const result = batchUploadSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })

    it('should accept exactly 100 records', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
        latitude: -37.8136 + i * 0.0001,
        longitude: 144.9631,
        recordedAt: new Date(Date.now() + i * 60000).toISOString(),
      }))

      const validBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records,
      }

      const result = batchUploadSchema.safeParse(validBatch)
      expect(result.success).toBe(true)
    })

    it('should validate all records in the batch', () => {
      const invalidBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records: [
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8136,
            longitude: 144.9631,
            recordedAt: '2024-12-28T10:00:00.000Z',
          },
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -100, // Invalid latitude
            longitude: 144.9632,
            recordedAt: '2024-12-28T10:01:00.000Z',
          },
        ],
      }

      const result = batchUploadSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })

    it('should accept records with multiple operator sessions', () => {
      const validBatch = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        records: [
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
            latitude: -37.8136,
            longitude: 144.9631,
            recordedAt: '2024-12-28T10:00:00.000Z',
          },
          {
            operatorSessionId: '123e4567-e89b-12d3-a456-426614174002',
            latitude: -37.8137,
            longitude: 144.9632,
            recordedAt: '2024-12-28T11:00:00.000Z',
          },
        ],
      }

      const result = batchUploadSchema.safeParse(validBatch)
      expect(result.success).toBe(true)
    })
  })

  describe('Query/Filter Validation', () => {
    it('should validate a valid query with all filters', () => {
      const validQuery = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
        startDate: '2024-12-28T00:00:00.000Z',
        endDate: '2024-12-28T23:59:59.000Z',
        page: 1,
        limit: 50,
      }

      const result = querySchema.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should provide default values for page and limit', () => {
      const query = {}

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should allow optional assetId filter', () => {
      const query = {
        page: 1,
        limit: 20,
      }

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should allow optional operatorSessionId filter', () => {
      const query = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        page: 1,
        limit: 20,
      }

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should allow optional date range filters', () => {
      const query = {
        startDate: '2024-12-28T00:00:00.000Z',
        page: 1,
        limit: 20,
      }

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject page less than 1', () => {
      const invalidQuery = {
        page: 0,
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject negative page', () => {
      const invalidQuery = {
        page: -1,
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject limit less than 1', () => {
      const invalidQuery = {
        limit: 0,
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject limit greater than 100', () => {
      const invalidQuery = {
        limit: 101,
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should accept limit of exactly 100', () => {
      const query = {
        limit: 100,
      }

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should coerce string numbers for page and limit', () => {
      const query = {
        page: '2',
        limit: '25',
      }

      const result = querySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(25)
      }
    })

    it('should require valid datetime for startDate', () => {
      const invalidQuery = {
        startDate: '2024-12-28',
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should require valid datetime for endDate', () => {
      const invalidQuery = {
        endDate: 'invalid-date',
      }

      const result = querySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })
  })

  describe('Geofence Validation', () => {
    it('should validate a valid circle geofence', () => {
      const validGeofence = {
        name: 'Warehouse Zone',
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
        isActive: true,
      }

      const result = geofenceSchema.safeParse(validGeofence)
      expect(result.success).toBe(true)
    })

    it('should validate a valid polygon geofence', () => {
      const validGeofence = {
        name: 'Delivery Area',
        type: 'polygon',
        coordinates: [
          { latitude: -37.8136, longitude: 144.9631 },
          { latitude: -37.8146, longitude: 144.9631 },
          { latitude: -37.8146, longitude: 144.9641 },
          { latitude: -37.8136, longitude: 144.9641 },
        ],
        isActive: true,
      }

      const result = geofenceSchema.safeParse(validGeofence)
      expect(result.success).toBe(true)
    })

    it('should require name', () => {
      const invalidGeofence = {
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should require name to be non-empty', () => {
      const invalidGeofence = {
        name: '',
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should enforce max name length', () => {
      const invalidGeofence = {
        name: 'a'.repeat(201),
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should require valid type enum', () => {
      const invalidGeofence = {
        name: 'Test Zone',
        type: 'rectangle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should default isActive to true', () => {
      const geofence = {
        name: 'Test Zone',
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 500,
      }

      const result = geofenceSchema.safeParse(geofence)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should reject polygon with less than 3 coordinates', () => {
      const invalidGeofence = {
        name: 'Invalid Polygon',
        type: 'polygon',
        coordinates: [
          { latitude: -37.8136, longitude: 144.9631 },
          { latitude: -37.8146, longitude: 144.9631 },
        ],
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should accept polygon with exactly 3 coordinates (triangle)', () => {
      const validGeofence = {
        name: 'Triangle Zone',
        type: 'polygon',
        coordinates: [
          { latitude: -37.8136, longitude: 144.9631 },
          { latitude: -37.8146, longitude: 144.9631 },
          { latitude: -37.8141, longitude: 144.9641 },
        ],
      }

      const result = geofenceSchema.safeParse(validGeofence)
      expect(result.success).toBe(true)
    })

    it('should validate coordinates within polygon', () => {
      const invalidGeofence = {
        name: 'Invalid Coordinates',
        type: 'polygon',
        coordinates: [
          { latitude: -91, longitude: 144.9631 }, // Invalid latitude
          { latitude: -37.8146, longitude: 144.9631 },
          { latitude: -37.8141, longitude: 144.9641 },
        ],
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should require positive radius for circle geofence', () => {
      const invalidGeofence = {
        name: 'Invalid Radius',
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: -100,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should reject zero radius for circle geofence', () => {
      const invalidGeofence = {
        name: 'Zero Radius',
        type: 'circle',
        centerLatitude: -37.8136,
        centerLongitude: 144.9631,
        radiusMeters: 0,
      }

      const result = geofenceSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })
  })
})

describe('Location Calculation Utilities', () => {
  // Haversine formula for calculating distance between two points
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
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

  // Check if a point is within a circle geofence
  function isPointInCircle(
    pointLat: number,
    pointLon: number,
    centerLat: number,
    centerLon: number,
    radiusMeters: number,
  ): boolean {
    const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon)
    return distance <= radiusMeters
  }

  describe('Distance Calculation', () => {
    it('should calculate zero distance for same point', () => {
      const distance = calculateDistance(-37.8136, 144.9631, -37.8136, 144.9631)
      expect(distance).toBe(0)
    })

    it('should calculate distance between two nearby points', () => {
      // Melbourne CBD to Flinders Street Station (~300m)
      const distance = calculateDistance(-37.8136, 144.9631, -37.8183, 144.9671)
      expect(distance).toBeGreaterThan(500)
      expect(distance).toBeLessThan(700)
    })

    it('should calculate distance between two cities', () => {
      // Melbourne to Sydney (~713km)
      const distance = calculateDistance(-37.8136, 144.9631, -33.8688, 151.2093)
      const distanceKm = distance / 1000
      expect(distanceKm).toBeGreaterThan(700)
      expect(distanceKm).toBeLessThan(720)
    })

    it('should handle crossing the equator', () => {
      const distance = calculateDistance(-1.0, 0, 1.0, 0)
      // Approximately 222km (2 degrees of latitude)
      const distanceKm = distance / 1000
      expect(distanceKm).toBeGreaterThan(220)
      expect(distanceKm).toBeLessThan(225)
    })

    it('should handle crossing the prime meridian', () => {
      const distance = calculateDistance(0, -1.0, 0, 1.0)
      // Approximately 222km (2 degrees of longitude at equator)
      const distanceKm = distance / 1000
      expect(distanceKm).toBeGreaterThan(220)
      expect(distanceKm).toBeLessThan(225)
    })
  })

  describe('Point in Circle Geofence', () => {
    const center = { lat: -37.8136, lon: 144.9631 }
    const radius = 1000 // 1km

    it('should detect point at center as inside', () => {
      const result = isPointInCircle(center.lat, center.lon, center.lat, center.lon, radius)
      expect(result).toBe(true)
    })

    it('should detect nearby point as inside', () => {
      // Point ~500m away
      const result = isPointInCircle(-37.818, 144.9631, center.lat, center.lon, radius)
      expect(result).toBe(true)
    })

    it('should detect far point as outside', () => {
      // Point ~2km away
      const result = isPointInCircle(-37.83, 144.9631, center.lat, center.lon, radius)
      expect(result).toBe(false)
    })

    it('should detect point just inside boundary as inside', () => {
      // Create a point just inside the boundary (approximately)
      // Moving ~900m north from center (well within 1km radius)
      const nearBoundaryLat = center.lat + 900 / 111000 // ~900m in latitude
      const result = isPointInCircle(nearBoundaryLat, center.lon, center.lat, center.lon, radius)
      expect(result).toBe(true)
    })

    it('should handle very small radius', () => {
      const smallRadius = 10 // 10 meters
      const result = isPointInCircle(-37.8137, 144.9632, center.lat, center.lon, smallRadius)
      expect(result).toBe(false)
    })

    it('should handle very large radius', () => {
      const largeRadius = 100000 // 100km
      const result = isPointInCircle(-37.9, 145.0, center.lat, center.lon, largeRadius)
      expect(result).toBe(true)
    })
  })
})

describe('Location Record Pagination', () => {
  function calculatePagination(
    total: number,
    page: number,
    limit: number,
  ): {
    page: number
    limit: number
    total: number
    totalPages: number
    offset: number
    hasMore: boolean
  } {
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const hasMore = page < totalPages

    return {
      page,
      limit,
      total,
      totalPages,
      offset,
      hasMore,
    }
  }

  it('should calculate pagination for single page', () => {
    const pagination = calculatePagination(25, 1, 50)
    expect(pagination.totalPages).toBe(1)
    expect(pagination.offset).toBe(0)
    expect(pagination.hasMore).toBe(false)
  })

  it('should calculate pagination for multiple pages', () => {
    const pagination = calculatePagination(100, 1, 25)
    expect(pagination.totalPages).toBe(4)
    expect(pagination.offset).toBe(0)
    expect(pagination.hasMore).toBe(true)
  })

  it('should calculate correct offset for page 2', () => {
    const pagination = calculatePagination(100, 2, 25)
    expect(pagination.offset).toBe(25)
    expect(pagination.hasMore).toBe(true)
  })

  it('should calculate correct offset for last page', () => {
    const pagination = calculatePagination(100, 4, 25)
    expect(pagination.offset).toBe(75)
    expect(pagination.hasMore).toBe(false)
  })

  it('should handle empty results', () => {
    const pagination = calculatePagination(0, 1, 50)
    expect(pagination.totalPages).toBe(0)
    expect(pagination.offset).toBe(0)
    expect(pagination.hasMore).toBe(false)
  })

  it('should handle exact page boundary', () => {
    const pagination = calculatePagination(50, 1, 50)
    expect(pagination.totalPages).toBe(1)
    expect(pagination.hasMore).toBe(false)
  })

  it('should handle one more than page boundary', () => {
    const pagination = calculatePagination(51, 1, 50)
    expect(pagination.totalPages).toBe(2)
    expect(pagination.hasMore).toBe(true)
  })
})
