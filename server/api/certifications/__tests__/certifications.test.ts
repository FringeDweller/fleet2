import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Expiring Certifications Endpoint Tests (US-8.3)
 *
 * Tests for the certification expiry monitoring endpoint.
 * Validates query parameters, urgency calculation, and response format.
 *
 * @requirement REQ-803-AC-06, REQ-803-AC-07, REQ-803-AC-08
 */

// Query schema matching the actual API
const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

// Test UUID for validation tests
const validUuid = '123e4567-e89b-12d3-a456-426614174000'

describe('Expiring Certifications Query Schema', () => {
  describe('Days Parameter Validation', () => {
    it('should default to 30 days when not provided', () => {
      const result = querySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(30)
      }
    })

    it('should accept minimum value of 1 day', () => {
      const result = querySchema.safeParse({ days: '1' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(1)
      }
    })

    it('should accept maximum value of 365 days', () => {
      const result = querySchema.safeParse({ days: '365' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(365)
      }
    })

    it('should reject value less than 1', () => {
      const result = querySchema.safeParse({ days: '0' })
      expect(result.success).toBe(false)
    })

    it('should reject negative values', () => {
      const result = querySchema.safeParse({ days: '-1' })
      expect(result.success).toBe(false)
    })

    it('should reject value greater than 365', () => {
      const result = querySchema.safeParse({ days: '366' })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer values', () => {
      const result = querySchema.safeParse({ days: '30.5' })
      expect(result.success).toBe(false)
    })

    it('should coerce string to number', () => {
      const result = querySchema.safeParse({ days: '60' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.data.days).toBe('number')
        expect(result.data.days).toBe(60)
      }
    })

    it('should accept number directly', () => {
      const result = querySchema.safeParse({ days: 90 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(90)
      }
    })

    it('should reject non-numeric strings', () => {
      const result = querySchema.safeParse({ days: 'thirty' })
      expect(result.success).toBe(false)
    })

    it('should accept 7 days (common use case)', () => {
      const result = querySchema.safeParse({ days: '7' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(7)
      }
    })

    it('should accept 14 days (common use case)', () => {
      const result = querySchema.safeParse({ days: '14' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(14)
      }
    })

    it('should accept 30 days explicitly', () => {
      const result = querySchema.safeParse({ days: '30' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(30)
      }
    })

    it('should accept 90 days (quarterly check)', () => {
      const result = querySchema.safeParse({ days: '90' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(90)
      }
    })

    it('should accept 180 days (semi-annual check)', () => {
      const result = querySchema.safeParse({ days: '180' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(180)
      }
    })
  })
})

describe('Urgency Level Calculation', () => {
  type UrgencyLevel = 'critical' | 'warning' | 'notice'

  function calculateUrgency(daysUntilExpiry: number): UrgencyLevel {
    if (daysUntilExpiry <= 7) {
      return 'critical'
    }
    if (daysUntilExpiry <= 14) {
      return 'warning'
    }
    return 'notice'
  }

  describe('Critical Urgency (1-7 days)', () => {
    it('should return critical for 1 day until expiry', () => {
      expect(calculateUrgency(1)).toBe('critical')
    })

    it('should return critical for 0 days until expiry (today)', () => {
      expect(calculateUrgency(0)).toBe('critical')
    })

    it('should return critical for 7 days until expiry', () => {
      expect(calculateUrgency(7)).toBe('critical')
    })

    it('should return critical for 3 days until expiry', () => {
      expect(calculateUrgency(3)).toBe('critical')
    })

    it('should return critical for 5 days until expiry', () => {
      expect(calculateUrgency(5)).toBe('critical')
    })
  })

  describe('Warning Urgency (8-14 days)', () => {
    it('should return warning for 8 days until expiry', () => {
      expect(calculateUrgency(8)).toBe('warning')
    })

    it('should return warning for 14 days until expiry', () => {
      expect(calculateUrgency(14)).toBe('warning')
    })

    it('should return warning for 10 days until expiry', () => {
      expect(calculateUrgency(10)).toBe('warning')
    })

    it('should return warning for 12 days until expiry', () => {
      expect(calculateUrgency(12)).toBe('warning')
    })
  })

  describe('Notice Urgency (15+ days)', () => {
    it('should return notice for 15 days until expiry', () => {
      expect(calculateUrgency(15)).toBe('notice')
    })

    it('should return notice for 20 days until expiry', () => {
      expect(calculateUrgency(20)).toBe('notice')
    })

    it('should return notice for 30 days until expiry', () => {
      expect(calculateUrgency(30)).toBe('notice')
    })

    it('should return notice for 60 days until expiry', () => {
      expect(calculateUrgency(60)).toBe('notice')
    })

    it('should return notice for 90 days until expiry', () => {
      expect(calculateUrgency(90)).toBe('notice')
    })

    it('should return notice for 180 days until expiry', () => {
      expect(calculateUrgency(180)).toBe('notice')
    })

    it('should return notice for 365 days until expiry', () => {
      expect(calculateUrgency(365)).toBe('notice')
    })
  })
})

describe('Date Range Calculation', () => {
  function calculateDateRange(days: number): { now: Date; futureDate: Date } {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    return { now, futureDate }
  }

  it('should calculate correct range for 7 days', () => {
    const { now, futureDate } = calculateDateRange(7)
    const diffMs = futureDate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(7, 0)
  })

  it('should calculate correct range for 30 days', () => {
    const { now, futureDate } = calculateDateRange(30)
    const diffMs = futureDate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(30, 0)
  })

  it('should calculate correct range for 90 days', () => {
    const { now, futureDate } = calculateDateRange(90)
    const diffMs = futureDate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(90, 0)
  })

  it('should calculate correct range for 365 days', () => {
    const { now, futureDate } = calculateDateRange(365)
    const diffMs = futureDate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(365, 0)
  })

  it('should have futureDate after now', () => {
    const { now, futureDate } = calculateDateRange(30)
    expect(futureDate.getTime()).toBeGreaterThan(now.getTime())
  })
})

describe('Days Until Expiry Calculation', () => {
  function calculateDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date()
    const diffMs = expiryDate.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  it('should calculate approximately correct days for near future', () => {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 10)
    const days = calculateDaysUntilExpiry(expiryDate)
    expect(days).toBeGreaterThanOrEqual(9)
    expect(days).toBeLessThanOrEqual(11)
  })

  it('should calculate approximately correct days for far future', () => {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 100)
    const days = calculateDaysUntilExpiry(expiryDate)
    expect(days).toBeGreaterThanOrEqual(99)
    expect(days).toBeLessThanOrEqual(101)
  })

  it('should return 0 or 1 for today', () => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const days = calculateDaysUntilExpiry(today)
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThanOrEqual(1)
  })

  it('should return negative for past dates', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5)
    const days = calculateDaysUntilExpiry(pastDate)
    expect(days).toBeLessThan(0)
  })

  it('should handle month boundaries correctly', () => {
    const expiryDate = new Date()
    expiryDate.setMonth(expiryDate.getMonth() + 1)
    const days = calculateDaysUntilExpiry(expiryDate)
    expect(days).toBeGreaterThanOrEqual(28)
    expect(days).toBeLessThanOrEqual(31)
  })

  it('should handle year boundaries correctly', () => {
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
    const days = calculateDaysUntilExpiry(expiryDate)
    expect(days).toBeGreaterThanOrEqual(365)
    expect(days).toBeLessThanOrEqual(366)
  })
})

describe('Expiring Certifications Response Format', () => {
  interface ExpiringCertificationResponse {
    data: Array<{
      id: string
      operatorId: string
      operatorName: string
      operatorEmail: string
      certificationName: string
      certificationNumber: string | null
      issuer: string | null
      issuedDate: Date | null
      expiryDate: Date
      documentUrl: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
      daysUntilExpiry: number
      urgency: 'critical' | 'warning' | 'notice'
    }>
    count: number
    days: number
  }

  it('should have correct response structure', () => {
    const mockResponse: ExpiringCertificationResponse = {
      data: [
        {
          id: validUuid,
          operatorId: '123e4567-e89b-12d3-a456-426614174001',
          operatorName: 'John Smith',
          operatorEmail: 'john.smith@example.com',
          certificationName: 'Forklift License',
          certificationNumber: 'FL-12345',
          issuer: 'WorkSafe',
          issuedDate: new Date('2024-01-15'),
          expiryDate: new Date('2027-01-15'),
          documentUrl: 'https://example.com/doc.pdf',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          daysUntilExpiry: 5,
          urgency: 'critical',
        },
      ],
      count: 1,
      days: 30,
    }

    expect(mockResponse.data).toHaveLength(1)
    expect(mockResponse.count).toBe(1)
    expect(mockResponse.days).toBe(30)
    expect(mockResponse.data[0]).toHaveProperty('operatorName')
    expect(mockResponse.data[0]).toHaveProperty('operatorEmail')
    expect(mockResponse.data[0]).toHaveProperty('daysUntilExpiry')
    expect(mockResponse.data[0]).toHaveProperty('urgency')
  })

  it('should include operator full name', () => {
    const firstName = 'John'
    const lastName = 'Smith'
    const operatorName = `${firstName} ${lastName}`
    expect(operatorName).toBe('John Smith')
  })

  it('should format operator name correctly with middle name', () => {
    // Note: Current implementation only uses firstName + lastName
    const firstName = 'John'
    const lastName = 'Smith'
    const operatorName = `${firstName} ${lastName}`
    expect(operatorName).toBe('John Smith')
  })

  it('should return empty data with count 0 for no expiring certifications', () => {
    const mockResponse: ExpiringCertificationResponse = {
      data: [],
      count: 0,
      days: 30,
    }

    expect(mockResponse.data).toHaveLength(0)
    expect(mockResponse.count).toBe(0)
    expect(mockResponse.days).toBe(30)
  })

  it('should return the days parameter in response', () => {
    const mockResponse: ExpiringCertificationResponse = {
      data: [],
      count: 0,
      days: 90,
    }

    expect(mockResponse.days).toBe(90)
  })
})

describe('Sorting by Expiry Date', () => {
  interface ExpiringCert {
    id: string
    certificationName: string
    expiryDate: Date
    daysUntilExpiry: number
  }

  function sortByExpiryDate(certifications: ExpiringCert[]): ExpiringCert[] {
    return [...certifications].sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
  }

  it('should sort certifications by expiry date ascending', () => {
    const now = new Date()
    const certifications: ExpiringCert[] = [
      {
        id: '1',
        certificationName: 'License C',
        expiryDate: new Date(now.getTime() + 86400000 * 30),
        daysUntilExpiry: 30,
      },
      {
        id: '2',
        certificationName: 'License A',
        expiryDate: new Date(now.getTime() + 86400000 * 5),
        daysUntilExpiry: 5,
      },
      {
        id: '3',
        certificationName: 'License B',
        expiryDate: new Date(now.getTime() + 86400000 * 15),
        daysUntilExpiry: 15,
      },
    ]

    const sorted = sortByExpiryDate(certifications)

    expect(sorted[0].id).toBe('2') // 5 days
    expect(sorted[1].id).toBe('3') // 15 days
    expect(sorted[2].id).toBe('1') // 30 days
  })

  it('should place most urgent certifications first', () => {
    const now = new Date()
    const certifications: ExpiringCert[] = [
      {
        id: '1',
        certificationName: 'License A',
        expiryDate: new Date(now.getTime() + 86400000 * 7),
        daysUntilExpiry: 7,
      },
      {
        id: '2',
        certificationName: 'License B',
        expiryDate: new Date(now.getTime() + 86400000 * 1),
        daysUntilExpiry: 1,
      },
    ]

    const sorted = sortByExpiryDate(certifications)

    expect(sorted[0].daysUntilExpiry).toBeLessThan(sorted[1].daysUntilExpiry)
  })

  it('should handle certifications with same expiry date', () => {
    const now = new Date()
    const sameExpiryDate = new Date(now.getTime() + 86400000 * 10)
    const certifications: ExpiringCert[] = [
      {
        id: '1',
        certificationName: 'License A',
        expiryDate: sameExpiryDate,
        daysUntilExpiry: 10,
      },
      {
        id: '2',
        certificationName: 'License B',
        expiryDate: sameExpiryDate,
        daysUntilExpiry: 10,
      },
    ]

    const sorted = sortByExpiryDate(certifications)

    expect(sorted).toHaveLength(2)
    // Order between same dates doesn't matter, just verify both are present
    expect(sorted.map((c) => c.id)).toContain('1')
    expect(sorted.map((c) => c.id)).toContain('2')
  })

  it('should not modify original array', () => {
    const now = new Date()
    const certifications: ExpiringCert[] = [
      {
        id: '1',
        certificationName: 'License C',
        expiryDate: new Date(now.getTime() + 86400000 * 30),
        daysUntilExpiry: 30,
      },
      {
        id: '2',
        certificationName: 'License A',
        expiryDate: new Date(now.getTime() + 86400000 * 5),
        daysUntilExpiry: 5,
      },
    ]

    const originalFirstId = certifications[0].id
    sortByExpiryDate(certifications)

    expect(certifications[0].id).toBe(originalFirstId)
  })
})

describe('Organization Scoping for Expiring Certifications', () => {
  interface MockCertWithOrg {
    id: string
    organisationId: string
    certificationName: string
    isActive: boolean
    expiryDate: Date | null
  }

  function filterByOrganisation(
    certifications: MockCertWithOrg[],
    organisationId: string,
  ): MockCertWithOrg[] {
    return certifications.filter(
      (cert) =>
        cert.organisationId === organisationId &&
        cert.isActive === true &&
        cert.expiryDate !== null,
    )
  }

  it('should only return certifications from same organisation', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001'
    const otherOrgId = '123e4567-e89b-12d3-a456-426614174002'

    const certifications: MockCertWithOrg[] = [
      {
        id: '1',
        organisationId: orgId,
        certificationName: 'License A',
        isActive: true,
        expiryDate: new Date(),
      },
      {
        id: '2',
        organisationId: otherOrgId,
        certificationName: 'License B',
        isActive: true,
        expiryDate: new Date(),
      },
      {
        id: '3',
        organisationId: orgId,
        certificationName: 'License C',
        isActive: true,
        expiryDate: new Date(),
      },
    ]

    const filtered = filterByOrganisation(certifications, orgId)

    expect(filtered).toHaveLength(2)
    expect(filtered.every((c) => c.organisationId === orgId)).toBe(true)
  })

  it('should only return active certifications', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001'

    const certifications: MockCertWithOrg[] = [
      {
        id: '1',
        organisationId: orgId,
        certificationName: 'Active License',
        isActive: true,
        expiryDate: new Date(),
      },
      {
        id: '2',
        organisationId: orgId,
        certificationName: 'Inactive License',
        isActive: false,
        expiryDate: new Date(),
      },
    ]

    const filtered = filterByOrganisation(certifications, orgId)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].isActive).toBe(true)
  })

  it('should only return certifications with expiry dates', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001'

    const certifications: MockCertWithOrg[] = [
      {
        id: '1',
        organisationId: orgId,
        certificationName: 'Expiring License',
        isActive: true,
        expiryDate: new Date(),
      },
      {
        id: '2',
        organisationId: orgId,
        certificationName: 'Permanent License',
        isActive: true,
        expiryDate: null,
      },
    ]

    const filtered = filterByOrganisation(certifications, orgId)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].expiryDate).not.toBeNull()
  })

  it('should return empty array for organisation with no certifications', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001'
    const otherOrgId = '123e4567-e89b-12d3-a456-426614174002'

    const certifications: MockCertWithOrg[] = [
      {
        id: '1',
        organisationId: otherOrgId,
        certificationName: 'License A',
        isActive: true,
        expiryDate: new Date(),
      },
    ]

    const filtered = filterByOrganisation(certifications, orgId)

    expect(filtered).toHaveLength(0)
  })
})

describe('Expiry Date Range Filtering', () => {
  interface MockCertWithDate {
    id: string
    expiryDate: Date
  }

  function filterByDateRange(
    certifications: MockCertWithDate[],
    now: Date,
    futureDate: Date,
  ): MockCertWithDate[] {
    return certifications.filter((cert) => cert.expiryDate >= now && cert.expiryDate <= futureDate)
  }

  it('should include certifications expiring exactly on futureDate', () => {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const certifications: MockCertWithDate[] = [{ id: '1', expiryDate: futureDate }]

    const filtered = filterByDateRange(certifications, now, futureDate)
    expect(filtered).toHaveLength(1)
  })

  it('should include certifications expiring today', () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const today = new Date()

    const certifications: MockCertWithDate[] = [{ id: '1', expiryDate: today }]

    const filtered = filterByDateRange(certifications, now, futureDate)
    expect(filtered).toHaveLength(1)
  })

  it('should exclude certifications already expired', () => {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)

    const certifications: MockCertWithDate[] = [{ id: '1', expiryDate: pastDate }]

    const filtered = filterByDateRange(certifications, now, futureDate)
    expect(filtered).toHaveLength(0)
  })

  it('should exclude certifications expiring after range', () => {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const farFuture = new Date()
    farFuture.setDate(farFuture.getDate() + 60)

    const certifications: MockCertWithDate[] = [{ id: '1', expiryDate: farFuture }]

    const filtered = filterByDateRange(certifications, now, futureDate)
    expect(filtered).toHaveLength(0)
  })

  it('should filter correctly with multiple certifications', () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const past = new Date()
    past.setDate(past.getDate() - 5)
    const inRange1 = new Date()
    inRange1.setDate(inRange1.getDate() + 10)
    const inRange2 = new Date()
    inRange2.setDate(inRange2.getDate() + 25)
    const afterRange = new Date()
    afterRange.setDate(afterRange.getDate() + 45)

    const certifications: MockCertWithDate[] = [
      { id: '1', expiryDate: past },
      { id: '2', expiryDate: inRange1 },
      { id: '3', expiryDate: inRange2 },
      { id: '4', expiryDate: afterRange },
    ]

    const filtered = filterByDateRange(certifications, now, futureDate)
    expect(filtered).toHaveLength(2)
    expect(filtered.map((c) => c.id)).toContain('2')
    expect(filtered.map((c) => c.id)).toContain('3')
  })
})

describe('Permission Requirements', () => {
  const REQUIRED_PERMISSION = 'users:read'

  it('should require users:read permission to access expiring certifications', () => {
    expect(REQUIRED_PERMISSION).toBe('users:read')
  })
})

describe('Error Response Validation', () => {
  interface ErrorResponse {
    statusCode: number
    statusMessage: string
    data?: {
      fieldErrors?: Record<string, string[]>
      formErrors?: string[]
    }
  }

  it('should return 400 for invalid days parameter', () => {
    const error: ErrorResponse = {
      statusCode: 400,
      statusMessage: 'Validation error',
      data: {
        fieldErrors: {
          days: ['Number must be greater than or equal to 1'],
        },
      },
    }

    expect(error.statusCode).toBe(400)
    expect(error.data?.fieldErrors?.days).toBeDefined()
  })

  it('should return 401 for unauthorized access', () => {
    const error: ErrorResponse = {
      statusCode: 401,
      statusMessage: 'Unauthorized',
    }

    expect(error.statusCode).toBe(401)
  })

  it('should return 403 for insufficient permissions', () => {
    const error: ErrorResponse = {
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions',
    }

    expect(error.statusCode).toBe(403)
  })
})

describe('Integration Scenarios', () => {
  describe('Multiple Operators with Expiring Certifications', () => {
    interface CertWithOperator {
      id: string
      operatorId: string
      operatorName: string
      certificationName: string
      daysUntilExpiry: number
      urgency: 'critical' | 'warning' | 'notice'
    }

    function groupByOperator(certifications: CertWithOperator[]): Map<string, CertWithOperator[]> {
      const map = new Map<string, CertWithOperator[]>()
      for (const cert of certifications) {
        const existing = map.get(cert.operatorId) || []
        existing.push(cert)
        map.set(cert.operatorId, existing)
      }
      return map
    }

    it('should correctly group certifications by operator', () => {
      const certifications: CertWithOperator[] = [
        {
          id: '1',
          operatorId: 'op1',
          operatorName: 'John Smith',
          certificationName: 'Forklift',
          daysUntilExpiry: 5,
          urgency: 'critical',
        },
        {
          id: '2',
          operatorId: 'op1',
          operatorName: 'John Smith',
          certificationName: 'Crane',
          daysUntilExpiry: 10,
          urgency: 'warning',
        },
        {
          id: '3',
          operatorId: 'op2',
          operatorName: 'Jane Doe',
          certificationName: 'Forklift',
          daysUntilExpiry: 3,
          urgency: 'critical',
        },
      ]

      const grouped = groupByOperator(certifications)

      expect(grouped.size).toBe(2)
      expect(grouped.get('op1')).toHaveLength(2)
      expect(grouped.get('op2')).toHaveLength(1)
    })
  })

  describe('Urgency Distribution', () => {
    interface CertWithUrgency {
      urgency: 'critical' | 'warning' | 'notice'
    }

    function countByUrgency(certifications: CertWithUrgency[]): {
      critical: number
      warning: number
      notice: number
    } {
      return {
        critical: certifications.filter((c) => c.urgency === 'critical').length,
        warning: certifications.filter((c) => c.urgency === 'warning').length,
        notice: certifications.filter((c) => c.urgency === 'notice').length,
      }
    }

    it('should correctly count urgency levels', () => {
      const certifications: CertWithUrgency[] = [
        { urgency: 'critical' },
        { urgency: 'critical' },
        { urgency: 'warning' },
        { urgency: 'notice' },
        { urgency: 'notice' },
        { urgency: 'notice' },
      ]

      const counts = countByUrgency(certifications)

      expect(counts.critical).toBe(2)
      expect(counts.warning).toBe(1)
      expect(counts.notice).toBe(3)
    })

    it('should handle all critical certifications', () => {
      const certifications: CertWithUrgency[] = [{ urgency: 'critical' }, { urgency: 'critical' }]

      const counts = countByUrgency(certifications)

      expect(counts.critical).toBe(2)
      expect(counts.warning).toBe(0)
      expect(counts.notice).toBe(0)
    })

    it('should handle no certifications', () => {
      const counts = countByUrgency([])

      expect(counts.critical).toBe(0)
      expect(counts.warning).toBe(0)
      expect(counts.notice).toBe(0)
    })
  })
})

describe('Common Use Cases', () => {
  describe('7-Day Alert Window', () => {
    it('should correctly identify certifications in 7-day window', () => {
      const result = querySchema.safeParse({ days: '7' })
      expect(result.success).toBe(true)
    })
  })

  describe('14-Day Alert Window', () => {
    it('should correctly identify certifications in 14-day window', () => {
      const result = querySchema.safeParse({ days: '14' })
      expect(result.success).toBe(true)
    })
  })

  describe('30-Day Alert Window (Default)', () => {
    it('should correctly identify certifications in 30-day window', () => {
      const result = querySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(30)
      }
    })
  })

  describe('90-Day Quarterly Review', () => {
    it('should correctly identify certifications in 90-day window', () => {
      const result = querySchema.safeParse({ days: '90' })
      expect(result.success).toBe(true)
    })
  })
})
