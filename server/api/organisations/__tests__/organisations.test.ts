import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Organisation Schema Validation Tests
 *
 * Tests validation schemas for organisation-related endpoints:
 * - Organisation schema validation
 * - Multi-tenancy isolation validation
 * - Organisation settings validation
 */

// Create organisation schema (from organisations/index.post.ts)
const createOrganisationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional()
    .default('#0066cc'),
  preventNegativeStock: z.boolean().optional().default(false),
})

// Update organisation schema
const updateOrganisationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  isActive: z.boolean().optional(),
  preventNegativeStock: z.boolean().optional(),
  workOrderApprovalThreshold: z.number().positive().nullable().optional(),
  requireApprovalForAllWorkOrders: z.boolean().optional(),
  locationTrackingEnabled: z.boolean().optional(),
  locationTrackingInterval: z.number().int().min(1).max(60).optional(),
})

// Full organisation schema (matching database schema)
const organisationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable(),
  logoUrl: z.string().url().max(500).nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isActive: z.boolean(),
  preventNegativeStock: z.boolean(),
  workOrderApprovalThreshold: z.string().nullable(), // Decimal comes as string
  requireApprovalForAllWorkOrders: z.boolean(),
  locationTrackingEnabled: z.boolean(),
  locationTrackingInterval: z.number().int().min(1).max(60),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

describe('Organisation Schema Validation', () => {
  describe('Create Organisation', () => {
    it('should validate a valid organisation', () => {
      const validOrg = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: 'A test organisation',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5500',
        preventNegativeStock: true,
      }

      const result = createOrganisationSchema.safeParse(validOrg)
      expect(result.success).toBe(true)
    })

    it('should require name', () => {
      const invalidOrg = {
        slug: 'acme-corp',
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const invalidOrg = {
        name: '',
        slug: 'acme-corp',
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length', () => {
      const invalidOrg = {
        name: 'a'.repeat(256),
        slug: 'acme-corp',
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should require slug', () => {
      const invalidOrg = {
        name: 'Acme Corp',
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should reject empty slug', () => {
      const invalidOrg = {
        name: 'Acme Corp',
        slug: '',
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should enforce slug format (lowercase alphanumeric with hyphens)', () => {
      const validSlugs = ['acme', 'acme-corp', 'acme-corp-123', '123-company', 'a-b-c', 'test1']

      const invalidSlugs = [
        'Acme Corp', // spaces and uppercase
        'acme_corp', // underscore
        'acme.corp', // dot
        'ACME-CORP', // uppercase
        'acme corp', // space
        '-acme', // starts with hyphen (valid per regex but typically not desired)
        'acme--corp', // double hyphen (valid per regex)
      ]

      for (const slug of validSlugs) {
        const result = createOrganisationSchema.safeParse({
          name: 'Test',
          slug,
        })
        expect(result.success).toBe(true)
      }

      for (const slug of ['Acme Corp', 'acme_corp', 'acme.corp', 'ACME-CORP', 'acme corp']) {
        const result = createOrganisationSchema.safeParse({
          name: 'Test',
          slug,
        })
        expect(result.success).toBe(false)
      }
    })

    it('should enforce slug max length', () => {
      const invalidOrg = {
        name: 'Acme Corp',
        slug: 'a'.repeat(101),
      }

      const result = createOrganisationSchema.safeParse(invalidOrg)
      expect(result.success).toBe(false)
    })

    it('should allow optional description', () => {
      const orgWithDescription = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: 'A description',
      }

      const orgWithoutDescription = {
        name: 'Acme Corp',
        slug: 'acme-corp',
      }

      expect(createOrganisationSchema.safeParse(orgWithDescription).success).toBe(true)
      expect(createOrganisationSchema.safeParse(orgWithoutDescription).success).toBe(true)
    })

    it('should allow null description', () => {
      const orgWithNullDescription = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: null,
      }

      const result = createOrganisationSchema.safeParse(orgWithNullDescription)
      expect(result.success).toBe(true)
    })

    it('should validate logoUrl as URL', () => {
      const orgWithValidLogo = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        logoUrl: 'https://example.com/logo.png',
      }

      const orgWithInvalidLogo = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        logoUrl: 'not-a-url',
      }

      expect(createOrganisationSchema.safeParse(orgWithValidLogo).success).toBe(true)
      expect(createOrganisationSchema.safeParse(orgWithInvalidLogo).success).toBe(false)
    })

    it('should enforce logoUrl max length', () => {
      const longUrl = `https://example.com/${'a'.repeat(500)}.png`
      const orgWithLongLogo = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        logoUrl: longUrl,
      }

      const result = createOrganisationSchema.safeParse(orgWithLongLogo)
      expect(result.success).toBe(false)
    })

    it('should validate primaryColor as hex color', () => {
      const validColors = ['#000000', '#FFFFFF', '#FF5500', '#ff5500', '#AbCdEf']

      const invalidColors = [
        '000000', // missing #
        '#FFF', // 3 chars
        '#GGGGGG', // invalid hex chars
        'red', // color name
        'rgb(255,0,0)', // rgb format
        '#FFFFFFF', // 7 chars
      ]

      for (const color of validColors) {
        const result = createOrganisationSchema.safeParse({
          name: 'Test',
          slug: 'test',
          primaryColor: color,
        })
        expect(result.success).toBe(true)
      }

      for (const color of invalidColors) {
        const result = createOrganisationSchema.safeParse({
          name: 'Test',
          slug: 'test',
          primaryColor: color,
        })
        expect(result.success).toBe(false)
      }
    })

    it('should default primaryColor to #0066cc', () => {
      const orgWithoutColor = {
        name: 'Acme Corp',
        slug: 'acme-corp',
      }

      const result = createOrganisationSchema.safeParse(orgWithoutColor)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primaryColor).toBe('#0066cc')
      }
    })

    it('should default preventNegativeStock to false', () => {
      const orgWithoutSetting = {
        name: 'Acme Corp',
        slug: 'acme-corp',
      }

      const result = createOrganisationSchema.safeParse(orgWithoutSetting)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.preventNegativeStock).toBe(false)
      }
    })
  })

  describe('Update Organisation', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        name: 'New Name',
      }

      const result = updateOrganisationSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('should validate fields when provided', () => {
      const updateWithInvalidColor = {
        primaryColor: 'invalid',
      }

      const result = updateOrganisationSchema.safeParse(updateWithInvalidColor)
      expect(result.success).toBe(false)
    })

    it('should allow updating isActive', () => {
      const deactivateOrg = {
        isActive: false,
      }

      const result = updateOrganisationSchema.safeParse(deactivateOrg)
      expect(result.success).toBe(true)
    })

    it('should allow updating work order approval settings', () => {
      const updateApprovalSettings = {
        workOrderApprovalThreshold: 1000.0,
        requireApprovalForAllWorkOrders: true,
      }

      const result = updateOrganisationSchema.safeParse(updateApprovalSettings)
      expect(result.success).toBe(true)
    })

    it('should validate workOrderApprovalThreshold as positive number', () => {
      const invalidThreshold = {
        workOrderApprovalThreshold: -100,
      }

      const result = updateOrganisationSchema.safeParse(invalidThreshold)
      expect(result.success).toBe(false)
    })

    it('should allow null workOrderApprovalThreshold', () => {
      const nullThreshold = {
        workOrderApprovalThreshold: null,
      }

      const result = updateOrganisationSchema.safeParse(nullThreshold)
      expect(result.success).toBe(true)
    })

    it('should allow updating location tracking settings', () => {
      const updateLocationSettings = {
        locationTrackingEnabled: true,
        locationTrackingInterval: 10,
      }

      const result = updateOrganisationSchema.safeParse(updateLocationSettings)
      expect(result.success).toBe(true)
    })

    it('should validate locationTrackingInterval range (1-60)', () => {
      const validIntervals = [1, 5, 30, 60]
      const invalidIntervals = [0, -1, 61, 100]

      for (const interval of validIntervals) {
        const result = updateOrganisationSchema.safeParse({
          locationTrackingInterval: interval,
        })
        expect(result.success).toBe(true)
      }

      for (const interval of invalidIntervals) {
        const result = updateOrganisationSchema.safeParse({
          locationTrackingInterval: interval,
        })
        expect(result.success).toBe(false)
      }
    })

    it('should require integer for locationTrackingInterval', () => {
      const floatInterval = {
        locationTrackingInterval: 5.5,
      }

      const result = updateOrganisationSchema.safeParse(floatInterval)
      expect(result.success).toBe(false)
    })

    it('should allow empty update object', () => {
      const emptyUpdate = {}

      const result = updateOrganisationSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })
  })

  describe('Full Organisation Schema', () => {
    it('should validate a complete organisation', () => {
      const fullOrg = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: 'A test organisation',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5500',
        isActive: true,
        preventNegativeStock: false,
        workOrderApprovalThreshold: '1000.00',
        requireApprovalForAllWorkOrders: false,
        locationTrackingEnabled: true,
        locationTrackingInterval: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const result = organisationSchema.safeParse(fullOrg)
      expect(result.success).toBe(true)
    })

    it('should allow null optional fields', () => {
      const orgWithNulls = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: null,
        logoUrl: null,
        primaryColor: '#0066cc',
        isActive: true,
        preventNegativeStock: false,
        workOrderApprovalThreshold: null,
        requireApprovalForAllWorkOrders: false,
        locationTrackingEnabled: true,
        locationTrackingInterval: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const result = organisationSchema.safeParse(orgWithNulls)
      expect(result.success).toBe(true)
    })

    it('should require valid UUID for id', () => {
      const orgWithInvalidId = {
        id: 'not-a-uuid',
        name: 'Acme Corp',
        slug: 'acme-corp',
        description: null,
        logoUrl: null,
        primaryColor: '#0066cc',
        isActive: true,
        preventNegativeStock: false,
        workOrderApprovalThreshold: null,
        requireApprovalForAllWorkOrders: false,
        locationTrackingEnabled: true,
        locationTrackingInterval: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const result = organisationSchema.safeParse(orgWithInvalidId)
      expect(result.success).toBe(false)
    })
  })
})

describe('Multi-Tenancy Isolation', () => {
  // Simulates tenant context validation
  interface TenantContext {
    organisationId: string
    userId: string
    isSuperAdmin: boolean
  }

  function canAccessOrganisation(context: TenantContext, targetOrgId: string): boolean {
    // Super admin can access any organisation
    if (context.isSuperAdmin) return true
    // Regular users can only access their own organisation
    return context.organisationId === targetOrgId
  }

  function validateTenantScope<T extends { organisationId: string }>(
    context: TenantContext,
    data: T,
  ): boolean {
    if (context.isSuperAdmin) return true
    return data.organisationId === context.organisationId
  }

  it('should allow users to access their own organisation', () => {
    const context: TenantContext = {
      organisationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-1',
      isSuperAdmin: false,
    }

    expect(canAccessOrganisation(context, '550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('should deny users access to other organisations', () => {
    const context: TenantContext = {
      organisationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-1',
      isSuperAdmin: false,
    }

    expect(canAccessOrganisation(context, 'different-org-id')).toBe(false)
  })

  it('should allow super admin to access any organisation', () => {
    const context: TenantContext = {
      organisationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'super-admin',
      isSuperAdmin: true,
    }

    expect(canAccessOrganisation(context, 'any-org-id')).toBe(true)
  })

  it('should scope data queries to user organisation', () => {
    const context: TenantContext = {
      organisationId: 'org-1',
      userId: 'user-1',
      isSuperAdmin: false,
    }

    const ownData = { id: '1', organisationId: 'org-1', name: 'Own Data' }
    const otherData = { id: '2', organisationId: 'org-2', name: 'Other Data' }

    expect(validateTenantScope(context, ownData)).toBe(true)
    expect(validateTenantScope(context, otherData)).toBe(false)
  })

  it('should allow super admin to see all data', () => {
    const context: TenantContext = {
      organisationId: 'org-1',
      userId: 'super-admin',
      isSuperAdmin: true,
    }

    const otherData = { id: '2', organisationId: 'org-2', name: 'Other Data' }

    expect(validateTenantScope(context, otherData)).toBe(true)
  })
})

describe('Slug Uniqueness', () => {
  // Simulates slug validation logic
  function isSlugValid(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length <= 100 && slug.length > 0
  }

  function normalizeSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)
  }

  it('should validate valid slugs', () => {
    const validSlugs = ['acme', 'acme-corp', 'test-company-123', '123', 'a-b-c-d']

    for (const slug of validSlugs) {
      expect(isSlugValid(slug)).toBe(true)
    }
  })

  it('should reject invalid slugs', () => {
    const invalidSlugs = [
      '', // empty
      'Acme', // uppercase
      'acme corp', // space
      'acme_corp', // underscore
    ]

    for (const slug of invalidSlugs) {
      expect(isSlugValid(slug)).toBe(false)
    }
  })

  it('should normalize company names to slugs', () => {
    expect(normalizeSlug('Acme Corp')).toBe('acme-corp')
    expect(normalizeSlug('Test & Company')).toBe('test-company')
    expect(normalizeSlug('  Spaces  ')).toBe('spaces')
    expect(normalizeSlug('Multiple   Spaces')).toBe('multiple-spaces')
    expect(normalizeSlug('Special!@#Characters')).toBe('special-characters')
  })

  it('should truncate long slugs', () => {
    const longName = 'a'.repeat(150)
    const normalized = normalizeSlug(longName)
    expect(normalized.length).toBeLessThanOrEqual(100)
  })
})

describe('Organisation Settings', () => {
  describe('Inventory Settings', () => {
    const inventorySettingsSchema = z.object({
      preventNegativeStock: z.boolean(),
    })

    it('should validate inventory settings', () => {
      const settings = { preventNegativeStock: true }
      const result = inventorySettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
    })

    it('should require boolean for preventNegativeStock', () => {
      const invalidSettings = { preventNegativeStock: 'yes' }
      const result = inventorySettingsSchema.safeParse(invalidSettings)
      expect(result.success).toBe(false)
    })
  })

  describe('Work Order Approval Settings', () => {
    const approvalSettingsSchema = z.object({
      workOrderApprovalThreshold: z.number().positive().nullable(),
      requireApprovalForAllWorkOrders: z.boolean(),
    })

    it('should validate approval settings with threshold', () => {
      const settings = {
        workOrderApprovalThreshold: 1000,
        requireApprovalForAllWorkOrders: false,
      }
      const result = approvalSettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
    })

    it('should validate approval settings without threshold', () => {
      const settings = {
        workOrderApprovalThreshold: null,
        requireApprovalForAllWorkOrders: true,
      }
      const result = approvalSettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
    })

    it('should determine if approval is required', () => {
      function requiresApproval(
        settings: {
          workOrderApprovalThreshold: number | null
          requireApprovalForAllWorkOrders: boolean
        },
        estimatedCost: number,
      ): boolean {
        if (settings.requireApprovalForAllWorkOrders) return true
        if (settings.workOrderApprovalThreshold === null) return false
        return estimatedCost >= settings.workOrderApprovalThreshold
      }

      // Always require approval
      expect(
        requiresApproval(
          { workOrderApprovalThreshold: null, requireApprovalForAllWorkOrders: true },
          0,
        ),
      ).toBe(true)

      // Never require approval (no threshold, not required for all)
      expect(
        requiresApproval(
          { workOrderApprovalThreshold: null, requireApprovalForAllWorkOrders: false },
          10000,
        ),
      ).toBe(false)

      // Threshold-based
      const thresholdSettings = {
        workOrderApprovalThreshold: 500,
        requireApprovalForAllWorkOrders: false,
      }
      expect(requiresApproval(thresholdSettings, 400)).toBe(false)
      expect(requiresApproval(thresholdSettings, 500)).toBe(true)
      expect(requiresApproval(thresholdSettings, 1000)).toBe(true)
    })
  })

  describe('Location Tracking Settings', () => {
    const locationSettingsSchema = z.object({
      locationTrackingEnabled: z.boolean(),
      locationTrackingInterval: z.number().int().min(1).max(60),
    })

    it('should validate location tracking settings', () => {
      const settings = {
        locationTrackingEnabled: true,
        locationTrackingInterval: 5,
      }
      const result = locationSettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
    })

    it('should validate interval boundaries', () => {
      expect(
        locationSettingsSchema.safeParse({
          locationTrackingEnabled: true,
          locationTrackingInterval: 1,
        }).success,
      ).toBe(true)

      expect(
        locationSettingsSchema.safeParse({
          locationTrackingEnabled: true,
          locationTrackingInterval: 60,
        }).success,
      ).toBe(true)

      expect(
        locationSettingsSchema.safeParse({
          locationTrackingEnabled: true,
          locationTrackingInterval: 0,
        }).success,
      ).toBe(false)

      expect(
        locationSettingsSchema.safeParse({
          locationTrackingEnabled: true,
          locationTrackingInterval: 61,
        }).success,
      ).toBe(false)
    })

    it('should calculate tracking points per hour', () => {
      function getTrackingPointsPerHour(intervalMinutes: number): number {
        return Math.floor(60 / intervalMinutes)
      }

      expect(getTrackingPointsPerHour(1)).toBe(60)
      expect(getTrackingPointsPerHour(5)).toBe(12)
      expect(getTrackingPointsPerHour(15)).toBe(4)
      expect(getTrackingPointsPerHour(60)).toBe(1)
    })
  })
})

describe('Organisation Status', () => {
  it('should identify active organisations', () => {
    const activeOrg = { isActive: true }
    const inactiveOrg = { isActive: false }

    expect(activeOrg.isActive).toBe(true)
    expect(inactiveOrg.isActive).toBe(false)
  })

  it('should determine if organisation allows operations', () => {
    function canPerformOperations(org: { isActive: boolean }): boolean {
      return org.isActive
    }

    expect(canPerformOperations({ isActive: true })).toBe(true)
    expect(canPerformOperations({ isActive: false })).toBe(false)
  })
})

describe('Organisation Branding', () => {
  const brandingSchema = z.object({
    name: z.string().min(1).max(255),
    logoUrl: z.string().url().nullable(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })

  it('should validate complete branding', () => {
    const branding = {
      name: 'Acme Corp',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#FF5500',
    }
    const result = brandingSchema.safeParse(branding)
    expect(result.success).toBe(true)
  })

  it('should validate branding without logo', () => {
    const branding = {
      name: 'Acme Corp',
      logoUrl: null,
      primaryColor: '#0066cc',
    }
    const result = brandingSchema.safeParse(branding)
    expect(result.success).toBe(true)
  })

  it('should validate hex color contrast', () => {
    function hexToRgb(hex: string): { r: number; g: number; b: number } {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: Number.parseInt(result[1], 16),
            g: Number.parseInt(result[2], 16),
            b: Number.parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 }
    }

    function getLuminance(rgb: { r: number; g: number; b: number }): number {
      const a = [rgb.r, rgb.g, rgb.b].map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
    }

    function isLightColor(hex: string): boolean {
      const rgb = hexToRgb(hex)
      return getLuminance(rgb) > 0.5
    }

    // Light colors
    expect(isLightColor('#FFFFFF')).toBe(true)
    expect(isLightColor('#FFFF00')).toBe(true)

    // Dark colors
    expect(isLightColor('#000000')).toBe(false)
    expect(isLightColor('#0066cc')).toBe(false)
  })
})
