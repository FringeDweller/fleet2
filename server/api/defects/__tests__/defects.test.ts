import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Defects Schema and Business Logic Tests
 * Tests for Pre-Start Inspection Defects module (TEST-F09)
 */

// Defect schema matching the API validation
const defectSeverityEnum = z.enum(['minor', 'major', 'critical'])
const defectStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed'])

const createDefectSchema = z.object({
  assetId: z.string().uuid('Asset is required'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  severity: defectSeverityEnum.default('minor'),
  location: z.string().max(255).optional().nullable(),
  photos: z.array(z.string()).optional().nullable(),
  autoCreateWorkOrder: z.boolean().default(true),
})

const updateDefectSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  severity: defectSeverityEnum.optional(),
  status: defectStatusEnum.optional(),
  location: z.string().max(255).optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
})

describe('Defect Schema Validation', () => {
  describe('Create Defect Schema', () => {
    it('should validate a valid defect with all fields', () => {
      const validDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Cracked windshield',
        description: 'Large crack on driver side of windshield',
        category: 'Body Damage',
        severity: 'major',
        location: 'Front windshield - driver side',
        photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        autoCreateWorkOrder: true,
      }

      const result = createDefectSchema.safeParse(validDefect)
      expect(result.success).toBe(true)
    })

    it('should validate a defect with only required fields', () => {
      const minimalDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Check engine light on',
      }

      const result = createDefectSchema.safeParse(minimalDefect)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.severity).toBe('minor')
        expect(result.data.autoCreateWorkOrder).toBe(true)
      }
    })

    it('should require a valid UUID for assetId', () => {
      const invalidDefect = {
        assetId: 'not-a-uuid',
        title: 'Test defect',
      }

      const result = createDefectSchema.safeParse(invalidDefect)
      expect(result.success).toBe(false)
    })

    it('should require title', () => {
      const invalidDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createDefectSchema.safeParse(invalidDefect)
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const invalidDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: '',
      }

      const result = createDefectSchema.safeParse(invalidDefect)
      expect(result.success).toBe(false)
    })

    it('should enforce title max length of 255 characters', () => {
      const invalidDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'a'.repeat(256),
      }

      const result = createDefectSchema.safeParse(invalidDefect)
      expect(result.success).toBe(false)
    })

    it('should allow title at exactly max length', () => {
      const validDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'a'.repeat(255),
      }

      const result = createDefectSchema.safeParse(validDefect)
      expect(result.success).toBe(true)
    })

    it('should enforce category max length of 100 characters', () => {
      const invalidDefect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test defect',
        category: 'a'.repeat(101),
      }

      const result = createDefectSchema.safeParse(invalidDefect)
      expect(result.success).toBe(false)
    })

    it('should allow optional fields to be null', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test defect',
        description: null,
        category: null,
        location: null,
        photos: null,
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(true)
    })
  })

  describe('Severity Validation', () => {
    it('should accept minor severity', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Minor scratch',
        severity: 'minor',
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(true)
    })

    it('should accept major severity', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Cracked windshield',
        severity: 'major',
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(true)
    })

    it('should accept critical severity', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Brake failure',
        severity: 'critical',
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(true)
    })

    it('should reject invalid severity', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        severity: 'extreme',
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(false)
    })

    it('should default severity to minor when not provided', () => {
      const defect = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test defect',
      }

      const result = createDefectSchema.safeParse(defect)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.severity).toBe('minor')
      }
    })
  })

  describe('Update Defect Schema', () => {
    it('should validate valid status update', () => {
      const update = {
        status: 'resolved',
        resolutionNotes: 'Fixed the issue',
      }

      const result = updateDefectSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow all fields to be optional', () => {
      const update = {}

      const result = updateDefectSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates', () => {
      const update = {
        severity: 'critical',
      }

      const result = updateDefectSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})

describe('Defect Status Transitions', () => {
  // Define valid status transitions
  const validTransitions: Record<string, string[]> = {
    open: ['in_progress', 'resolved', 'closed'],
    in_progress: ['open', 'resolved', 'closed'],
    resolved: ['open', 'in_progress', 'closed'],
    closed: [], // Terminal state
  }

  it('should allow open to transition to in_progress', () => {
    expect(validTransitions.open).toContain('in_progress')
  })

  it('should allow open to transition to resolved', () => {
    expect(validTransitions.open).toContain('resolved')
  })

  it('should allow open to transition to closed', () => {
    expect(validTransitions.open).toContain('closed')
  })

  it('should allow in_progress to transition to resolved', () => {
    expect(validTransitions.in_progress).toContain('resolved')
  })

  it('should allow in_progress to revert to open', () => {
    expect(validTransitions.in_progress).toContain('open')
  })

  it('should allow resolved to reopen (transition to open)', () => {
    expect(validTransitions.resolved).toContain('open')
  })

  it('should allow resolved to transition to closed', () => {
    expect(validTransitions.resolved).toContain('closed')
  })

  it('should not allow closed to transition anywhere (terminal state)', () => {
    expect(validTransitions.closed).toHaveLength(0)
  })
})

describe('Defect Priority Mapping', () => {
  function mapSeverityToPriority(
    severity: 'minor' | 'major' | 'critical',
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical':
        return 'critical'
      case 'major':
        return 'high'
      case 'minor':
        return 'medium'
      default:
        return 'medium'
    }
  }

  it('should map critical severity to critical priority', () => {
    expect(mapSeverityToPriority('critical')).toBe('critical')
  })

  it('should map major severity to high priority', () => {
    expect(mapSeverityToPriority('major')).toBe('high')
  })

  it('should map minor severity to medium priority', () => {
    expect(mapSeverityToPriority('minor')).toBe('medium')
  })
})

describe('Defect Filtering and Search', () => {
  // Schema for query params validation
  const queryParamsSchema = z.object({
    search: z.string().optional(),
    assetId: z.string().uuid().optional(),
    status: defectStatusEnum.optional(),
    severity: defectSeverityEnum.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z
      .enum(['title', 'severity', 'status', 'reportedAt', 'updatedAt'])
      .default('reportedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })

  it('should validate valid query params', () => {
    const params = {
      search: 'brake',
      status: 'open',
      severity: 'critical',
      limit: '25',
      offset: '0',
      sortBy: 'reportedAt',
      sortOrder: 'desc',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(25)
      expect(result.data.offset).toBe(0)
    }
  })

  it('should default limit to 50 when not provided', () => {
    const params = {}

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('should cap limit at 100', () => {
    const params = {
      limit: '200',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(false)
  })

  it('should reject negative offset', () => {
    const params = {
      offset: '-1',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(false)
  })

  it('should default sortBy to reportedAt', () => {
    const params = {}

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sortBy).toBe('reportedAt')
    }
  })

  it('should default sortOrder to desc', () => {
    const params = {}

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sortOrder).toBe('desc')
    }
  })

  it('should reject invalid sortBy field', () => {
    const params = {
      sortBy: 'invalidField',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(false)
  })

  it('should accept valid assetId UUID filter', () => {
    const params = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(true)
  })

  it('should reject invalid assetId format', () => {
    const params = {
      assetId: 'not-a-uuid',
    }

    const result = queryParamsSchema.safeParse(params)
    expect(result.success).toBe(false)
  })
})

describe('Defect Photo Validation', () => {
  const photoArraySchema = z.array(z.string().url()).optional().nullable()

  it('should validate array of valid URLs', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.png',
      'https://storage.example.com/defects/photo3.webp',
    ]

    const result = photoArraySchema.safeParse(photos)
    expect(result.success).toBe(true)
  })

  it('should reject array containing invalid URL', () => {
    const photos = ['https://example.com/photo1.jpg', 'not-a-url', 'https://example.com/photo3.jpg']

    const result = photoArraySchema.safeParse(photos)
    expect(result.success).toBe(false)
  })

  it('should allow empty array', () => {
    const photos: string[] = []

    const result = photoArraySchema.safeParse(photos)
    expect(result.success).toBe(true)
  })

  it('should allow null', () => {
    const result = photoArraySchema.safeParse(null)
    expect(result.success).toBe(true)
  })

  it('should allow undefined', () => {
    const result = photoArraySchema.safeParse(undefined)
    expect(result.success).toBe(true)
  })
})

describe('Defect Auto Work Order Creation', () => {
  function shouldAutoCreateWorkOrder(
    severity: 'minor' | 'major' | 'critical',
    autoCreateFlag: boolean,
  ): boolean {
    return autoCreateFlag && (severity === 'major' || severity === 'critical')
  }

  it('should create work order for critical severity when flag is true', () => {
    expect(shouldAutoCreateWorkOrder('critical', true)).toBe(true)
  })

  it('should create work order for major severity when flag is true', () => {
    expect(shouldAutoCreateWorkOrder('major', true)).toBe(true)
  })

  it('should not create work order for minor severity even when flag is true', () => {
    expect(shouldAutoCreateWorkOrder('minor', true)).toBe(false)
  })

  it('should not create work order when flag is false', () => {
    expect(shouldAutoCreateWorkOrder('critical', false)).toBe(false)
    expect(shouldAutoCreateWorkOrder('major', false)).toBe(false)
    expect(shouldAutoCreateWorkOrder('minor', false)).toBe(false)
  })
})

describe('Defect Location Validation', () => {
  const locationSchema = z.string().max(255).optional().nullable()

  it('should accept valid location string', () => {
    const locations = [
      'Front left tire',
      'Engine compartment',
      'Rear bumper - passenger side',
      'Dashboard - center console',
      "Driver's seat cushion",
    ]

    for (const location of locations) {
      const result = locationSchema.safeParse(location)
      expect(result.success).toBe(true)
    }
  })

  it('should reject location exceeding 255 characters', () => {
    const longLocation = 'a'.repeat(256)
    const result = locationSchema.safeParse(longLocation)
    expect(result.success).toBe(false)
  })

  it('should accept location at exactly 255 characters', () => {
    const maxLocation = 'a'.repeat(255)
    const result = locationSchema.safeParse(maxLocation)
    expect(result.success).toBe(true)
  })

  it('should allow null location', () => {
    const result = locationSchema.safeParse(null)
    expect(result.success).toBe(true)
  })
})

describe('Defect Category Validation', () => {
  // Common defect categories for fleet vehicles
  const validCategories = [
    'Engine',
    'Transmission',
    'Brakes',
    'Tires',
    'Electrical',
    'Body Damage',
    'Lights',
    'Fluid Leaks',
    'Interior',
    'Safety Equipment',
    'Exhaust',
    'Suspension',
    'HVAC',
    'Other',
  ]

  const categorySchema = z.string().max(100).optional().nullable()

  it('should accept all common defect categories', () => {
    for (const category of validCategories) {
      const result = categorySchema.safeParse(category)
      expect(result.success).toBe(true)
    }
  })

  it('should allow custom category within length limit', () => {
    const customCategory = 'Custom Category Name'
    const result = categorySchema.safeParse(customCategory)
    expect(result.success).toBe(true)
  })

  it('should reject category exceeding 100 characters', () => {
    const longCategory = 'a'.repeat(101)
    const result = categorySchema.safeParse(longCategory)
    expect(result.success).toBe(false)
  })
})
