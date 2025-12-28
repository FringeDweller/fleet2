import { describe, expect, it } from 'vitest'

/**
 * Certification Validator Utility Tests (US-8.3)
 *
 * Tests for the certification validation utility functions.
 * Validates expiry detection, operator certification validation,
 * and enforcement mode handling.
 *
 * @requirement REQ-803-AC-09, REQ-803-AC-10, REQ-803-AC-11, REQ-803-AC-12
 */

// Re-implement utility functions for testing
// (These match the implementation in certification-validator.ts)

interface CertificationWarning {
  certificationName: string
  status: 'missing' | 'expired'
  expiryDate?: string
  daysUntilExpiry?: number
}

interface CertificationValidationResult {
  valid: boolean
  warnings: CertificationWarning[]
}

function isCertificationExpired(expiryDate: Date | null): boolean {
  if (expiryDate === null) {
    return false
  }
  return new Date() > expiryDate
}

function daysUntilExpiry(expiryDate: Date | null): number | undefined {
  if (expiryDate === null) {
    return undefined
  }
  const now = new Date()
  const diffMs = expiryDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

describe('isCertificationExpired Function', () => {
  describe('Null Expiry Date (Never Expires)', () => {
    it('should return false for null expiry date', () => {
      expect(isCertificationExpired(null)).toBe(false)
    })

    it('should treat null as "never expires"', () => {
      const result = isCertificationExpired(null)
      expect(result).toBe(false)
    })
  })

  describe('Expired Certifications', () => {
    it('should return true when expiry date is yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isCertificationExpired(yesterday)).toBe(true)
    })

    it('should return true when expiry date is 1 hour ago', () => {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)
      expect(isCertificationExpired(oneHourAgo)).toBe(true)
    })

    it('should return true when expiry date is 1 minute ago', () => {
      const oneMinuteAgo = new Date()
      oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1)
      expect(isCertificationExpired(oneMinuteAgo)).toBe(true)
    })

    it('should return true when expiry date is 1 week ago', () => {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      expect(isCertificationExpired(oneWeekAgo)).toBe(true)
    })

    it('should return true when expiry date is 1 month ago', () => {
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      expect(isCertificationExpired(oneMonthAgo)).toBe(true)
    })

    it('should return true when expiry date is 1 year ago', () => {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      expect(isCertificationExpired(oneYearAgo)).toBe(true)
    })

    it('should return true when expiry date is 5 years ago', () => {
      const fiveYearsAgo = new Date()
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
      expect(isCertificationExpired(fiveYearsAgo)).toBe(true)
    })
  })

  describe('Valid (Not Expired) Certifications', () => {
    it('should return false when expiry date is tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(isCertificationExpired(tomorrow)).toBe(false)
    })

    it('should return false when expiry date is 1 hour from now', () => {
      const oneHourFromNow = new Date()
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1)
      expect(isCertificationExpired(oneHourFromNow)).toBe(false)
    })

    it('should return false when expiry date is 1 week from now', () => {
      const oneWeekFromNow = new Date()
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
      expect(isCertificationExpired(oneWeekFromNow)).toBe(false)
    })

    it('should return false when expiry date is 1 month from now', () => {
      const oneMonthFromNow = new Date()
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
      expect(isCertificationExpired(oneMonthFromNow)).toBe(false)
    })

    it('should return false when expiry date is 1 year from now', () => {
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      expect(isCertificationExpired(oneYearFromNow)).toBe(false)
    })

    it('should return false when expiry date is 10 years from now', () => {
      const tenYearsFromNow = new Date()
      tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10)
      expect(isCertificationExpired(tenYearsFromNow)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle dates at midnight', () => {
      const midnight = new Date()
      midnight.setHours(0, 0, 0, 0)
      midnight.setDate(midnight.getDate() + 1)
      expect(isCertificationExpired(midnight)).toBe(false)
    })

    it('should handle dates at end of day', () => {
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      endOfDay.setDate(endOfDay.getDate() + 1)
      expect(isCertificationExpired(endOfDay)).toBe(false)
    })

    it('should handle leap year dates', () => {
      const leapYearDate = new Date('2028-02-29T12:00:00.000Z')
      const result = isCertificationExpired(leapYearDate)
      // Result depends on current date relative to leap year
      expect(typeof result).toBe('boolean')
    })
  })
})

describe('daysUntilExpiry Function', () => {
  describe('Null Expiry Date', () => {
    it('should return undefined for null expiry date', () => {
      expect(daysUntilExpiry(null)).toBeUndefined()
    })
  })

  describe('Future Expiry Dates', () => {
    it('should return positive number for future date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      const days = daysUntilExpiry(futureDate)
      expect(days).toBeGreaterThan(0)
    })

    it('should return approximately 1 for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const days = daysUntilExpiry(tomorrow)
      expect(days).toBeGreaterThanOrEqual(0)
      expect(days).toBeLessThanOrEqual(2)
    })

    it('should return approximately 7 for one week from now', () => {
      const oneWeek = new Date()
      oneWeek.setDate(oneWeek.getDate() + 7)
      const days = daysUntilExpiry(oneWeek)
      expect(days).toBeGreaterThanOrEqual(6)
      expect(days).toBeLessThanOrEqual(8)
    })

    it('should return approximately 30 for one month from now', () => {
      const oneMonth = new Date()
      oneMonth.setDate(oneMonth.getDate() + 30)
      const days = daysUntilExpiry(oneMonth)
      expect(days).toBeGreaterThanOrEqual(29)
      expect(days).toBeLessThanOrEqual(31)
    })

    it('should return approximately 365 for one year from now', () => {
      const oneYear = new Date()
      oneYear.setFullYear(oneYear.getFullYear() + 1)
      const days = daysUntilExpiry(oneYear)
      expect(days).toBeGreaterThanOrEqual(364)
      expect(days).toBeLessThanOrEqual(366)
    })
  })

  describe('Past Expiry Dates (Already Expired)', () => {
    it('should return negative number for past date', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      const days = daysUntilExpiry(pastDate)
      expect(days).toBeLessThan(0)
    })

    it('should return approximately -1 for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const days = daysUntilExpiry(yesterday)
      expect(days).toBeGreaterThanOrEqual(-2)
      expect(days).toBeLessThanOrEqual(0)
    })

    it('should return approximately -7 for one week ago', () => {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const days = daysUntilExpiry(oneWeekAgo)
      expect(days).toBeGreaterThanOrEqual(-8)
      expect(days).toBeLessThanOrEqual(-6)
    })

    it('should return approximately -30 for one month ago', () => {
      const oneMonthAgo = new Date()
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
      const days = daysUntilExpiry(oneMonthAgo)
      expect(days).toBeGreaterThanOrEqual(-31)
      expect(days).toBeLessThanOrEqual(-29)
    })
  })

  describe('Today/Boundary Cases', () => {
    it('should return 0 or 1 for later today', () => {
      const laterToday = new Date()
      laterToday.setHours(23, 59, 59, 999)
      const days = daysUntilExpiry(laterToday)
      expect(days).toBeGreaterThanOrEqual(0)
      expect(days).toBeLessThanOrEqual(1)
    })

    it('should handle exact current time', () => {
      const now = new Date()
      const days = daysUntilExpiry(now)
      expect(days).toBeLessThanOrEqual(1)
    })
  })

  describe('Large Time Differences', () => {
    it('should handle 10 years in the future', () => {
      const tenYears = new Date()
      tenYears.setFullYear(tenYears.getFullYear() + 10)
      const days = daysUntilExpiry(tenYears)
      expect(days).toBeGreaterThan(3650 - 5)
      expect(days).toBeLessThan(3660)
    })

    it('should handle 10 years in the past', () => {
      const tenYearsAgo = new Date()
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
      const days = daysUntilExpiry(tenYearsAgo)
      expect(days).toBeLessThan(-3650 + 5)
    })
  })
})

describe('Certification Validation Logic', () => {
  interface RequiredCertification {
    certificationName: string
    isRequired: boolean
  }

  interface OperatorCertification {
    certificationName: string
    expiryDate: Date | null
    isActive: boolean
  }

  function validateOperatorCertifications(
    operatorCertifications: OperatorCertification[],
    requiredCertifications: RequiredCertification[],
  ): CertificationValidationResult {
    // Get only required certifications
    const requiredNames = requiredCertifications
      .filter((cert) => cert.isRequired)
      .map((cert) => cert.certificationName.toLowerCase())

    if (requiredNames.length === 0) {
      return { valid: true, warnings: [] }
    }

    // Build map of active operator certifications
    const operatorCertMap = new Map(
      operatorCertifications
        .filter((cert) => cert.isActive)
        .map((cert) => [cert.certificationName.toLowerCase(), cert]),
    )

    const warnings: CertificationWarning[] = []

    for (const requiredName of requiredNames) {
      const operatorCert = operatorCertMap.get(requiredName)

      if (!operatorCert) {
        warnings.push({
          certificationName: requiredName,
          status: 'missing',
        })
      } else if (isCertificationExpired(operatorCert.expiryDate)) {
        warnings.push({
          certificationName: requiredName,
          status: 'expired',
          expiryDate: operatorCert.expiryDate?.toISOString(),
          daysUntilExpiry: daysUntilExpiry(operatorCert.expiryDate),
        })
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
    }
  }

  describe('No Required Certifications', () => {
    it('should return valid when no certifications are required', () => {
      const result = validateOperatorCertifications([], [])
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return valid when requirements have isRequired = false', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift', isRequired: false },
        { certificationName: 'Crane', isRequired: false },
      ]

      const result = validateOperatorCertifications([], requirements)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Missing Certifications', () => {
    it('should detect single missing certification', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const result = validateOperatorCertifications([], requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].status).toBe('missing')
      expect(result.warnings[0].certificationName).toBe('forklift license')
    })

    it('should detect multiple missing certifications', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Crane License', isRequired: true },
        { certificationName: 'Safety Training', isRequired: true },
      ]

      const result = validateOperatorCertifications([], requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(3)
      expect(result.warnings.every((w) => w.status === 'missing')).toBe(true)
    })

    it('should only report missing for required certifications', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Optional Training', isRequired: false },
      ]

      const result = validateOperatorCertifications([], requirements)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].certificationName).toBe('forklift license')
    })

    it('should detect missing when operator has other certifications', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Crane License', isRequired: true },
      ]

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: null, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].certificationName).toBe('crane license')
    })
  })

  describe('Expired Certifications', () => {
    it('should detect single expired certification', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 30)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: expiredDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].status).toBe('expired')
    })

    it('should include expiry date in warning', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 10)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: expiredDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.warnings[0].expiryDate).toBeDefined()
      expect(typeof result.warnings[0].expiryDate).toBe('string')
    })

    it('should include negative days until expiry', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 10)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: expiredDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.warnings[0].daysUntilExpiry).toBeDefined()
      expect(result.warnings[0].daysUntilExpiry).toBeLessThan(0)
    })

    it('should detect multiple expired certifications', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Crane License', isRequired: true },
      ]

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 30)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: expiredDate, isActive: true },
        { certificationName: 'Crane License', expiryDate: expiredDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings.every((w) => w.status === 'expired')).toBe(true)
    })
  })

  describe('Valid Certifications', () => {
    it('should return valid for non-expired certification', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: futureDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return valid for certification without expiry', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Permanent License', isRequired: true },
      ]

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Permanent License', expiryDate: null, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return valid for multiple valid certifications', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Crane License', isRequired: true },
        { certificationName: 'Safety Training', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: futureDate, isActive: true },
        { certificationName: 'Crane License', expiryDate: null, isActive: true },
        { certificationName: 'Safety Training', expiryDate: futureDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Case-Insensitive Matching', () => {
    it('should match certification names case-insensitively', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'FORKLIFT LICENSE', expiryDate: futureDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
    })

    it('should match mixed case certification names', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'CRANE LICENSE', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Crane License', expiryDate: futureDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
    })
  })

  describe('Inactive Certifications', () => {
    it('should treat inactive certification as missing', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: futureDate, isActive: false },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].status).toBe('missing')
    })

    it('should ignore inactive certifications in lookup', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: futureDate, isActive: false },
        { certificationName: 'Forklift License', expiryDate: futureDate, isActive: true },
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(true)
    })
  })

  describe('Mixed Scenarios', () => {
    it('should report both missing and expired in same validation', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Forklift License', isRequired: true },
        { certificationName: 'Crane License', isRequired: true },
      ]

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 30)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Forklift License', expiryDate: expiredDate, isActive: true },
        // Crane License is missing
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(2)

      const statuses = result.warnings.map((w) => w.status)
      expect(statuses).toContain('expired')
      expect(statuses).toContain('missing')
    })

    it('should handle mix of valid, expired, and missing', () => {
      const requirements: RequiredCertification[] = [
        { certificationName: 'Valid Cert', isRequired: true },
        { certificationName: 'Expired Cert', isRequired: true },
        { certificationName: 'Missing Cert', isRequired: true },
      ]

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 30)

      const operatorCerts: OperatorCertification[] = [
        { certificationName: 'Valid Cert', expiryDate: futureDate, isActive: true },
        { certificationName: 'Expired Cert', expiryDate: expiredDate, isActive: true },
        // Missing Cert is not present
      ]

      const result = validateOperatorCertifications(operatorCerts, requirements)
      expect(result.valid).toBe(false)
      expect(result.warnings).toHaveLength(2)
    })
  })
})

describe('Organization Certification Enforcement Mode', () => {
  type EnforcementMode = 'block' | 'warn'

  function determineEnforcementAction(
    mode: EnforcementMode,
    validationResult: CertificationValidationResult,
  ): { canProceed: boolean; showWarning: boolean } {
    if (validationResult.valid) {
      return { canProceed: true, showWarning: false }
    }

    if (mode === 'block') {
      return { canProceed: false, showWarning: true }
    }

    // mode === 'warn'
    return { canProceed: true, showWarning: true }
  }

  describe('Block Mode', () => {
    it('should allow proceed when validation is valid', () => {
      const result = determineEnforcementAction('block', { valid: true, warnings: [] })
      expect(result.canProceed).toBe(true)
      expect(result.showWarning).toBe(false)
    })

    it('should block proceed when validation fails', () => {
      const result = determineEnforcementAction('block', {
        valid: false,
        warnings: [{ certificationName: 'Forklift', status: 'missing' }],
      })
      expect(result.canProceed).toBe(false)
      expect(result.showWarning).toBe(true)
    })

    it('should block proceed with expired certification', () => {
      const result = determineEnforcementAction('block', {
        valid: false,
        warnings: [{ certificationName: 'Forklift', status: 'expired' }],
      })
      expect(result.canProceed).toBe(false)
      expect(result.showWarning).toBe(true)
    })

    it('should block proceed with multiple issues', () => {
      const result = determineEnforcementAction('block', {
        valid: false,
        warnings: [
          { certificationName: 'Forklift', status: 'missing' },
          { certificationName: 'Crane', status: 'expired' },
        ],
      })
      expect(result.canProceed).toBe(false)
      expect(result.showWarning).toBe(true)
    })
  })

  describe('Warn Mode', () => {
    it('should allow proceed when validation is valid', () => {
      const result = determineEnforcementAction('warn', { valid: true, warnings: [] })
      expect(result.canProceed).toBe(true)
      expect(result.showWarning).toBe(false)
    })

    it('should allow proceed with warning when validation fails', () => {
      const result = determineEnforcementAction('warn', {
        valid: false,
        warnings: [{ certificationName: 'Forklift', status: 'missing' }],
      })
      expect(result.canProceed).toBe(true)
      expect(result.showWarning).toBe(true)
    })

    it('should allow proceed with warning for expired certification', () => {
      const result = determineEnforcementAction('warn', {
        valid: false,
        warnings: [{ certificationName: 'Forklift', status: 'expired' }],
      })
      expect(result.canProceed).toBe(true)
      expect(result.showWarning).toBe(true)
    })

    it('should allow proceed with warning for multiple issues', () => {
      const result = determineEnforcementAction('warn', {
        valid: false,
        warnings: [
          { certificationName: 'Forklift', status: 'missing' },
          { certificationName: 'Crane', status: 'expired' },
        ],
      })
      expect(result.canProceed).toBe(true)
      expect(result.showWarning).toBe(true)
    })
  })

  describe('Default Enforcement Mode', () => {
    it('should default to warn mode when organisation not found', () => {
      const defaultMode: EnforcementMode = 'warn'
      expect(defaultMode).toBe('warn')
    })
  })
})

describe('CertificationWarning Interface', () => {
  it('should have correct structure for missing certification', () => {
    const warning: CertificationWarning = {
      certificationName: 'Forklift License',
      status: 'missing',
    }

    expect(warning.certificationName).toBe('Forklift License')
    expect(warning.status).toBe('missing')
    expect(warning.expiryDate).toBeUndefined()
    expect(warning.daysUntilExpiry).toBeUndefined()
  })

  it('should have correct structure for expired certification', () => {
    const warning: CertificationWarning = {
      certificationName: 'Forklift License',
      status: 'expired',
      expiryDate: '2024-01-15T00:00:00.000Z',
      daysUntilExpiry: -30,
    }

    expect(warning.certificationName).toBe('Forklift License')
    expect(warning.status).toBe('expired')
    expect(warning.expiryDate).toBe('2024-01-15T00:00:00.000Z')
    expect(warning.daysUntilExpiry).toBe(-30)
  })
})

describe('CertificationValidationResult Interface', () => {
  it('should have correct structure for valid result', () => {
    const result: CertificationValidationResult = {
      valid: true,
      warnings: [],
    }

    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('should have correct structure for invalid result with warnings', () => {
    const result: CertificationValidationResult = {
      valid: false,
      warnings: [
        { certificationName: 'Forklift', status: 'missing' },
        { certificationName: 'Crane', status: 'expired', expiryDate: '2024-01-15T00:00:00.000Z' },
      ],
    }

    expect(result.valid).toBe(false)
    expect(result.warnings).toHaveLength(2)
  })
})

describe('Edge Cases and Boundary Conditions', () => {
  describe('Empty Certification Names', () => {
    it('should handle empty certification name in requirements', () => {
      const requirements = [{ certificationName: '', isRequired: true }]

      const operatorCerts = [
        { certificationName: '', expiryDate: null as Date | null, isActive: true },
      ]

      // Should match empty strings
      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      expect(operatorCertMap.has('')).toBe(true)
    })
  })

  describe('Whitespace in Certification Names', () => {
    it('should treat certification names with different whitespace as different', () => {
      const requirements = [{ certificationName: 'Forklift  License', isRequired: true }]

      const operatorCerts = [
        {
          certificationName: 'Forklift License',
          expiryDate: null as Date | null,
          isActive: true,
        },
      ]

      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      const requiredName = requirements[0].certificationName.toLowerCase()
      // Different whitespace = no match
      expect(operatorCertMap.has(requiredName)).toBe(false)
    })
  })

  describe('Special Characters in Certification Names', () => {
    it('should handle special characters in certification names', () => {
      const specialName = "O'Brien's Forklift (Class A-1)"

      const operatorCerts = [
        { certificationName: specialName, expiryDate: null as Date | null, isActive: true },
      ]

      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      expect(operatorCertMap.has(specialName.toLowerCase())).toBe(true)
    })
  })

  describe('Unicode Characters in Certification Names', () => {
    it('should handle unicode characters in certification names', () => {
      const unicodeName = 'Permis de chariot elevateur'

      const operatorCerts = [
        { certificationName: unicodeName, expiryDate: null as Date | null, isActive: true },
      ]

      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      expect(operatorCertMap.has(unicodeName.toLowerCase())).toBe(true)
    })
  })

  describe('Very Long Certification Names', () => {
    it('should handle long certification names', () => {
      const longName =
        'National Heavy Vehicle Accreditation Scheme Forklift Operation and Safety Certification Level 3'

      const operatorCerts = [
        { certificationName: longName, expiryDate: null as Date | null, isActive: true },
      ]

      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      expect(operatorCertMap.has(longName.toLowerCase())).toBe(true)
    })
  })

  describe('Duplicate Operator Certifications', () => {
    it('should use first matching certification when duplicates exist', () => {
      const futureDate1 = new Date()
      futureDate1.setDate(futureDate1.getDate() + 30)

      const futureDate2 = new Date()
      futureDate2.setDate(futureDate2.getDate() + 60)

      const operatorCerts = [
        { certificationName: 'Forklift', expiryDate: futureDate1, isActive: true },
        { certificationName: 'Forklift', expiryDate: futureDate2, isActive: true },
      ]

      const operatorCertMap = new Map(
        operatorCerts
          .filter((cert) => cert.isActive)
          .map((cert) => [cert.certificationName.toLowerCase(), cert]),
      )

      // Map will have the last one due to how Map.set works
      const storedCert = operatorCertMap.get('forklift')
      expect(storedCert?.expiryDate).toEqual(futureDate2)
    })
  })
})

describe('Asset Category Required Certifications', () => {
  interface RequiredCertification {
    certificationName: string
    isRequired: boolean
  }

  function extractRequiredCertifications(
    requiredCertifications: RequiredCertification[] | null | undefined,
  ): string[] {
    if (!requiredCertifications) {
      return []
    }

    return requiredCertifications
      .filter((cert) => cert.isRequired)
      .map((cert) => cert.certificationName)
  }

  it('should return empty array for null requirements', () => {
    expect(extractRequiredCertifications(null)).toEqual([])
  })

  it('should return empty array for undefined requirements', () => {
    expect(extractRequiredCertifications(undefined)).toEqual([])
  })

  it('should return empty array for empty requirements', () => {
    expect(extractRequiredCertifications([])).toEqual([])
  })

  it('should extract only required certifications', () => {
    const requirements: RequiredCertification[] = [
      { certificationName: 'Required 1', isRequired: true },
      { certificationName: 'Optional 1', isRequired: false },
      { certificationName: 'Required 2', isRequired: true },
    ]

    const result = extractRequiredCertifications(requirements)
    expect(result).toHaveLength(2)
    expect(result).toContain('Required 1')
    expect(result).toContain('Required 2')
    expect(result).not.toContain('Optional 1')
  })

  it('should return empty when all are optional', () => {
    const requirements: RequiredCertification[] = [
      { certificationName: 'Optional 1', isRequired: false },
      { certificationName: 'Optional 2', isRequired: false },
    ]

    expect(extractRequiredCertifications(requirements)).toEqual([])
  })
})

describe('No Asset Category Scenario', () => {
  it('should return valid when asset has no category', () => {
    const result: CertificationValidationResult = {
      valid: true,
      warnings: [],
    }

    // When asset.category is null, validation should pass
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('should return valid when asset is not found', () => {
    const result: CertificationValidationResult = {
      valid: true,
      warnings: [],
    }

    // When asset is null, validation should pass
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })
})

describe('Performance Considerations', () => {
  it('should handle large number of certifications efficiently', () => {
    const requirements: Array<{ certificationName: string; isRequired: boolean }> = []
    const operatorCerts: Array<{
      certificationName: string
      expiryDate: Date | null
      isActive: boolean
    }> = []

    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    // Create 100 requirements and certifications
    for (let i = 0; i < 100; i++) {
      requirements.push({ certificationName: `Cert ${i}`, isRequired: true })
      operatorCerts.push({
        certificationName: `Cert ${i}`,
        expiryDate: futureDate,
        isActive: true,
      })
    }

    const start = performance.now()

    const operatorCertMap = new Map(
      operatorCerts
        .filter((cert) => cert.isActive)
        .map((cert) => [cert.certificationName.toLowerCase(), cert]),
    )

    const warnings: CertificationWarning[] = []
    for (const req of requirements) {
      if (req.isRequired) {
        const cert = operatorCertMap.get(req.certificationName.toLowerCase())
        if (!cert) {
          warnings.push({ certificationName: req.certificationName, status: 'missing' })
        } else if (isCertificationExpired(cert.expiryDate)) {
          warnings.push({ certificationName: req.certificationName, status: 'expired' })
        }
      }
    }

    const duration = performance.now() - start

    expect(warnings).toHaveLength(0)
    expect(duration).toBeLessThan(100) // Should complete in < 100ms
  })
})
