import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Asset schema validation tests - based on server/api/assets/index.post.ts
const createAssetSchema = z.object({
  assetNumber: z.string().min(1, 'Asset number is required').max(50).optional(),
  vin: z.string().max(17).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  operationalHours: z.number().min(0).optional().default(0),
  mileage: z.number().min(0).optional().default(0),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional().default('active'),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
})

const updateAssetSchema = z.object({
  assetNumber: z.string().min(1).max(50).optional(),
  vin: z.string().max(17).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  operationalHours: z.number().min(0).optional(),
  mileage: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  isArchived: z.boolean().optional(),
  // Location fields
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
})

describe('Asset Schema Validation', () => {
  describe('Create Asset', () => {
    it('should validate a complete asset with all fields', () => {
      const validAsset = {
        assetNumber: 'FLT-0001',
        vin: '1HGBH41JXMN109186',
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        licensePlate: 'ABC-123',
        operationalHours: 100.5,
        mileage: 50000,
        status: 'active',
        description: 'Company vehicle for sales team',
        imageUrl: 'https://example.com/car.jpg',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createAssetSchema.safeParse(validAsset)
      expect(result.success).toBe(true)
    })

    it('should validate a minimal asset without optional fields', () => {
      const minimalAsset = {}

      const result = createAssetSchema.safeParse(minimalAsset)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active')
        expect(result.data.operationalHours).toBe(0)
        expect(result.data.mileage).toBe(0)
      }
    })

    it('should reject asset number exceeding max length', () => {
      const invalidAsset = {
        assetNumber: 'A'.repeat(51),
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should reject VIN exceeding 17 characters', () => {
      const invalidAsset = {
        vin: '1HGBH41JXMN10918678', // 18 characters
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept VIN with exactly 17 characters', () => {
      const validAsset = {
        vin: '1HGBH41JXMN109186', // 17 characters
      }

      const result = createAssetSchema.safeParse(validAsset)
      expect(result.success).toBe(true)
    })

    it('should reject year before 1900', () => {
      const invalidAsset = {
        year: 1899,
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should reject year after 2100', () => {
      const invalidAsset = {
        year: 2101,
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept years in valid range', () => {
      const yearsToTest = [1900, 2000, 2023, 2100]
      for (const year of yearsToTest) {
        const asset = { year }
        const result = createAssetSchema.safeParse(asset)
        expect(result.success).toBe(true)
      }
    })

    it('should reject negative mileage', () => {
      const invalidAsset = {
        mileage: -100,
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should reject negative operational hours', () => {
      const invalidAsset = {
        operationalHours: -10,
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept zero mileage and operational hours', () => {
      const asset = {
        mileage: 0,
        operationalHours: 0,
      }

      const result = createAssetSchema.safeParse(asset)
      expect(result.success).toBe(true)
    })

    it('should reject invalid status enum', () => {
      const invalidAsset = {
        status: 'unknown',
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept all valid status values', () => {
      const validStatuses = ['active', 'inactive', 'maintenance', 'disposed']
      for (const status of validStatuses) {
        const asset = { status }
        const result = createAssetSchema.safeParse(asset)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid URL for imageUrl', () => {
      const invalidAsset = {
        imageUrl: 'not-a-url',
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept valid URL for imageUrl', () => {
      const validAsset = {
        imageUrl: 'https://example.com/image.png',
      }

      const result = createAssetSchema.safeParse(validAsset)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID for categoryId', () => {
      const invalidAsset = {
        categoryId: 'not-a-uuid',
      }

      const result = createAssetSchema.safeParse(invalidAsset)
      expect(result.success).toBe(false)
    })

    it('should accept valid UUID for categoryId', () => {
      const validAsset = {
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createAssetSchema.safeParse(validAsset)
      expect(result.success).toBe(true)
    })

    it('should allow null values for nullable fields', () => {
      const asset = {
        vin: null,
        make: null,
        model: null,
        year: null,
        licensePlate: null,
        description: null,
        imageUrl: null,
        categoryId: null,
      }

      const result = createAssetSchema.safeParse(asset)
      expect(result.success).toBe(true)
    })
  })

  describe('Update Asset', () => {
    it('should validate partial update with only status', () => {
      const update = {
        status: 'maintenance',
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate update with location fields', () => {
      const update = {
        latitude: 37.7749,
        longitude: -122.4194,
        locationName: 'San Francisco Office',
        locationAddress: '123 Main St, San Francisco, CA',
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should reject latitude below -90', () => {
      const update = {
        latitude: -91,
        longitude: 0,
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject latitude above 90', () => {
      const update = {
        latitude: 91,
        longitude: 0,
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject longitude below -180', () => {
      const update = {
        latitude: 0,
        longitude: -181,
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject longitude above 180', () => {
      const update = {
        latitude: 0,
        longitude: 181,
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should accept valid coordinate boundaries', () => {
      const coordinates = [
        { latitude: -90, longitude: -180 },
        { latitude: 90, longitude: 180 },
        { latitude: 0, longitude: 0 },
        { latitude: 45.5, longitude: -73.6 },
      ]

      for (const coord of coordinates) {
        const result = updateAssetSchema.safeParse(coord)
        expect(result.success).toBe(true)
      }
    })

    it('should validate archive operation', () => {
      const update = {
        isArchived: true,
      }

      const result = updateAssetSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})

describe('Asset Status Transitions', () => {
  // Define valid status transitions
  const validTransitions: Record<string, string[]> = {
    active: ['inactive', 'maintenance', 'disposed'],
    inactive: ['active', 'maintenance', 'disposed'],
    maintenance: ['active', 'inactive', 'disposed'],
    disposed: [], // Disposed is a terminal state
  }

  function canTransition(from: string, to: string): boolean {
    return validTransitions[from]?.includes(to) ?? false
  }

  it('should allow active to transition to inactive', () => {
    expect(canTransition('active', 'inactive')).toBe(true)
  })

  it('should allow active to transition to maintenance', () => {
    expect(canTransition('active', 'maintenance')).toBe(true)
  })

  it('should allow active to transition to disposed', () => {
    expect(canTransition('active', 'disposed')).toBe(true)
  })

  it('should allow maintenance to transition back to active', () => {
    expect(canTransition('maintenance', 'active')).toBe(true)
  })

  it('should allow inactive to transition to active', () => {
    expect(canTransition('inactive', 'active')).toBe(true)
  })

  it('should not allow disposed to transition to any state', () => {
    expect(canTransition('disposed', 'active')).toBe(false)
    expect(canTransition('disposed', 'inactive')).toBe(false)
    expect(canTransition('disposed', 'maintenance')).toBe(false)
  })

  it('should not allow transition to same state', () => {
    expect(canTransition('active', 'active')).toBe(false)
    expect(canTransition('inactive', 'inactive')).toBe(false)
    expect(canTransition('maintenance', 'maintenance')).toBe(false)
  })
})

describe('Asset Number Generation', () => {
  function generateAssetNumber(count: number): string {
    return `FLT-${String(count + 1).padStart(4, '0')}`
  }

  it('should generate FLT-0001 for the first asset', () => {
    expect(generateAssetNumber(0)).toBe('FLT-0001')
  })

  it('should generate sequential numbers', () => {
    expect(generateAssetNumber(1)).toBe('FLT-0002')
    expect(generateAssetNumber(9)).toBe('FLT-0010')
    expect(generateAssetNumber(99)).toBe('FLT-0100')
    expect(generateAssetNumber(999)).toBe('FLT-1000')
  })

  it('should pad numbers correctly up to 4 digits', () => {
    expect(generateAssetNumber(0)).toHaveLength(8)
    expect(generateAssetNumber(9998)).toBe('FLT-9999')
  })

  it('should handle numbers beyond 9999', () => {
    expect(generateAssetNumber(9999)).toBe('FLT-10000')
    expect(generateAssetNumber(99999)).toBe('FLT-100000')
  })
})

describe('Asset Search and Filter Validation', () => {
  const searchFilterSchema = z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional(),
    categoryId: z.string().uuid().optional(),
    includeArchived: z.boolean().optional().default(false),
    hasLocation: z.enum(['true', 'false']).optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    yearMin: z.number().int().min(1900).max(2100).optional(),
    yearMax: z.number().int().min(1900).max(2100).optional(),
    mileageMin: z.number().min(0).optional(),
    mileageMax: z.number().min(0).optional(),
    hoursMin: z.number().min(0).optional(),
    hoursMax: z.number().min(0).optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    sortBy: z
      .enum([
        'assetNumber',
        'make',
        'model',
        'year',
        'status',
        'mileage',
        'operationalHours',
        'locationName',
        'lastLocationUpdate',
        'createdAt',
        'updatedAt',
      ])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })

  it('should validate valid search filters', () => {
    const filters = {
      search: 'Toyota',
      status: 'active',
      categoryId: '123e4567-e89b-12d3-a456-426614174000',
      includeArchived: false,
      limit: 25,
      offset: 0,
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should default limit to 50', () => {
    const filters = {}
    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('should enforce max limit of 100', () => {
    const filters = { limit: 150 }
    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should enforce min limit of 1', () => {
    const filters = { limit: 0 }
    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should reject negative offset', () => {
    const filters = { offset: -10 }
    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate year range filters', () => {
    const filters = {
      yearMin: 2010,
      yearMax: 2023,
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should validate mileage range filters', () => {
    const filters = {
      mileageMin: 0,
      mileageMax: 100000,
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should reject negative mileage filters', () => {
    const filters = {
      mileageMin: -100,
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate sort options', () => {
    const filters = {
      sortBy: 'assetNumber',
      sortOrder: 'asc',
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should reject invalid sortBy field', () => {
    const filters = {
      sortBy: 'invalidField',
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should reject invalid sortOrder', () => {
    const filters = {
      sortOrder: 'random',
    }

    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate hasLocation filter', () => {
    const withLocation = { hasLocation: 'true' }
    const withoutLocation = { hasLocation: 'false' }

    expect(searchFilterSchema.safeParse(withLocation).success).toBe(true)
    expect(searchFilterSchema.safeParse(withoutLocation).success).toBe(true)
  })

  it('should reject invalid hasLocation value', () => {
    const filters = { hasLocation: 'yes' }
    const result = searchFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })
})

describe('Asset Export Validation', () => {
  const exportFilterSchema = z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'disposed']).optional(),
    categoryId: z.string().uuid().optional(),
    includeArchived: z.boolean().optional().default(false),
    make: z.string().optional(),
    model: z.string().optional(),
    yearMin: z.number().int().optional(),
    yearMax: z.number().int().optional(),
    mileageMin: z.number().optional(),
    mileageMax: z.number().optional(),
    hoursMin: z.number().optional(),
    hoursMax: z.number().optional(),
  })

  it('should validate export with no filters', () => {
    const result = exportFilterSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should validate export with status filter', () => {
    const filters = { status: 'active' }
    const result = exportFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should validate export with multiple filters', () => {
    const filters = {
      status: 'active',
      make: 'Toyota',
      yearMin: 2020,
      yearMax: 2023,
    }

    const result = exportFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  describe('CSV Escape Function', () => {
    function escapeCSV(value: string | number | null | undefined): string {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    it('should return empty string for null', () => {
      expect(escapeCSV(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(escapeCSV(undefined)).toBe('')
    })

    it('should return simple strings unchanged', () => {
      expect(escapeCSV('Toyota')).toBe('Toyota')
      expect(escapeCSV('Camry')).toBe('Camry')
    })

    it('should wrap strings with commas in quotes', () => {
      expect(escapeCSV('San Francisco, CA')).toBe('"San Francisco, CA"')
    })

    it('should escape double quotes', () => {
      expect(escapeCSV('He said "hello"')).toBe('"He said ""hello"""')
    })

    it('should wrap strings with newlines in quotes', () => {
      expect(escapeCSV('Line 1\nLine 2')).toBe('"Line 1\nLine 2"')
    })

    it('should convert numbers to strings', () => {
      expect(escapeCSV(12345)).toBe('12345')
      expect(escapeCSV(123.45)).toBe('123.45')
    })
  })
})

describe('Asset Meters Validation', () => {
  const meterReadingSchema = z.object({
    mileage: z.number().min(0),
    operationalHours: z.number().min(0),
    timestamp: z.string().datetime().optional(),
  })

  it('should validate valid meter reading', () => {
    const reading = {
      mileage: 50000,
      operationalHours: 1500,
      timestamp: '2024-01-15T10:30:00.000Z',
    }

    const result = meterReadingSchema.safeParse(reading)
    expect(result.success).toBe(true)
  })

  it('should require non-negative mileage', () => {
    const reading = {
      mileage: -100,
      operationalHours: 1500,
    }

    const result = meterReadingSchema.safeParse(reading)
    expect(result.success).toBe(false)
  })

  it('should require non-negative operational hours', () => {
    const reading = {
      mileage: 50000,
      operationalHours: -10,
    }

    const result = meterReadingSchema.safeParse(reading)
    expect(result.success).toBe(false)
  })

  it('should validate meter reading without timestamp', () => {
    const reading = {
      mileage: 50000,
      operationalHours: 1500,
    }

    const result = meterReadingSchema.safeParse(reading)
    expect(result.success).toBe(true)
  })

  it('should reject invalid timestamp format', () => {
    const reading = {
      mileage: 50000,
      operationalHours: 1500,
      timestamp: '2024-01-15', // Missing time component
    }

    const result = meterReadingSchema.safeParse(reading)
    expect(result.success).toBe(false)
  })
})

describe('Asset Location Validation', () => {
  const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationName: z.string().max(255).optional(),
    locationAddress: z.string().optional(),
    notes: z.string().optional(),
    source: z.enum(['manual', 'gps', 'api', 'import']).optional().default('manual'),
  })

  it('should validate a complete location', () => {
    const location = {
      latitude: 37.7749,
      longitude: -122.4194,
      locationName: 'San Francisco Office',
      locationAddress: '123 Main St, San Francisco, CA 94105',
      notes: 'Updated via GPS',
      source: 'gps',
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(true)
  })

  it('should validate minimal location with just coordinates', () => {
    const location = {
      latitude: 37.7749,
      longitude: -122.4194,
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source).toBe('manual')
    }
  })

  it('should reject missing latitude', () => {
    const location = {
      longitude: -122.4194,
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(false)
  })

  it('should reject missing longitude', () => {
    const location = {
      latitude: 37.7749,
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(false)
  })

  it('should accept valid source values', () => {
    const sources = ['manual', 'gps', 'api', 'import']
    for (const source of sources) {
      const location = {
        latitude: 0,
        longitude: 0,
        source,
      }
      const result = locationSchema.safeParse(location)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid source value', () => {
    const location = {
      latitude: 0,
      longitude: 0,
      source: 'bluetooth',
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(false)
  })

  it('should enforce max length for locationName', () => {
    const location = {
      latitude: 0,
      longitude: 0,
      locationName: 'A'.repeat(256),
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(false)
  })

  it('should accept locationName at max length', () => {
    const location = {
      latitude: 0,
      longitude: 0,
      locationName: 'A'.repeat(255),
    }

    const result = locationSchema.safeParse(location)
    expect(result.success).toBe(true)
  })
})
