import { and, eq } from 'drizzle-orm'
import { db, schema } from './db'

export interface CertificationWarning {
  certificationName: string
  status: 'missing' | 'expired'
  expiryDate?: string
  daysUntilExpiry?: number
}

export interface CertificationValidationResult {
  valid: boolean
  warnings: CertificationWarning[]
}

/**
 * Checks if a certification is expired based on its expiry date.
 * Returns false if expiryDate is null (never expires) or in the future.
 */
export function isCertificationExpired(expiryDate: Date | null): boolean {
  if (expiryDate === null) {
    return false
  }
  return new Date() > expiryDate
}

/**
 * Calculates the number of days until a certification expires.
 * Returns undefined if expiryDate is null (never expires).
 * Returns negative number if already expired.
 */
export function daysUntilExpiry(expiryDate: Date | null): number | undefined {
  if (expiryDate === null) {
    return undefined
  }
  const now = new Date()
  const diffMs = expiryDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Validates that an operator has all required certifications for an asset's category.
 * Checks that certifications exist, are active, and not expired.
 *
 * @param operatorId - The ID of the operator to validate
 * @param assetId - The ID of the asset being operated
 * @param organisationId - The organisation ID for scoping queries
 * @returns Validation result with valid flag and any warnings
 */
export async function validateOperatorCertifications(
  operatorId: string,
  assetId: string,
  organisationId: string,
): Promise<CertificationValidationResult> {
  // Fetch the asset with its category to get required certifications
  const asset = await db.query.assets.findFirst({
    where: and(eq(schema.assets.id, assetId), eq(schema.assets.organisationId, organisationId)),
    with: {
      category: {
        columns: {
          id: true,
          requiredCertifications: true,
        },
      },
    },
  })

  // If no asset or no category, no certification requirements
  if (!asset || !asset.category) {
    return { valid: true, warnings: [] }
  }

  const requiredCertifications = asset.category.requiredCertifications || []

  // Filter to only certifications that are actually required
  const requiredCertNames = requiredCertifications
    .filter((cert) => cert.isRequired)
    .map((cert) => cert.certificationName)

  // If no certifications required, return valid
  if (requiredCertNames.length === 0) {
    return { valid: true, warnings: [] }
  }

  // Fetch operator's active certifications
  const operatorCertifications = await db.query.operatorCertifications.findMany({
    where: and(
      eq(schema.operatorCertifications.operatorId, operatorId),
      eq(schema.operatorCertifications.organisationId, organisationId),
      eq(schema.operatorCertifications.isActive, true),
    ),
  })

  // Build a map of operator's certifications by name for quick lookup
  const operatorCertMap = new Map(
    operatorCertifications.map((cert) => [cert.certificationName.toLowerCase(), cert]),
  )

  const warnings: CertificationWarning[] = []

  // Check each required certification
  for (const requiredName of requiredCertNames) {
    const operatorCert = operatorCertMap.get(requiredName.toLowerCase())

    if (!operatorCert) {
      // Missing certification
      warnings.push({
        certificationName: requiredName,
        status: 'missing',
      })
    } else if (isCertificationExpired(operatorCert.expiryDate)) {
      // Expired certification
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

/**
 * Gets the certification enforcement mode for an organisation.
 * Returns 'warn' as default if organisation not found.
 */
export async function getOrganisationCertificationEnforcement(
  organisationId: string,
): Promise<'block' | 'warn'> {
  const org = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, organisationId),
    columns: {
      certificationEnforcement: true,
    },
  })

  return org?.certificationEnforcement ?? 'warn'
}
