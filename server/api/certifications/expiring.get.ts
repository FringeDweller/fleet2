import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export default defineEventHandler(async (event) => {
  // Require users:read permission to view expiring certifications
  const currentUser = await requirePermission(event, 'users:read')

  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + result.data.days)

  // Find certifications expiring within the specified days
  const expiringCertifications = await db
    .select({
      id: schema.operatorCertifications.id,
      operatorId: schema.operatorCertifications.operatorId,
      certificationName: schema.operatorCertifications.certificationName,
      certificationNumber: schema.operatorCertifications.certificationNumber,
      issuer: schema.operatorCertifications.issuer,
      issuedDate: schema.operatorCertifications.issuedDate,
      expiryDate: schema.operatorCertifications.expiryDate,
      documentUrl: schema.operatorCertifications.documentUrl,
      isActive: schema.operatorCertifications.isActive,
      createdAt: schema.operatorCertifications.createdAt,
      updatedAt: schema.operatorCertifications.updatedAt,
      operatorFirstName: schema.users.firstName,
      operatorLastName: schema.users.lastName,
      operatorEmail: schema.users.email,
    })
    .from(schema.operatorCertifications)
    .innerJoin(schema.users, eq(schema.operatorCertifications.operatorId, schema.users.id))
    .where(
      and(
        eq(schema.operatorCertifications.organisationId, currentUser.organisationId),
        eq(schema.operatorCertifications.isActive, true),
        isNotNull(schema.operatorCertifications.expiryDate),
        gte(schema.operatorCertifications.expiryDate, now),
        lte(schema.operatorCertifications.expiryDate, futureDate),
      ),
    )
    .orderBy(asc(schema.operatorCertifications.expiryDate))

  // Add days until expiry and operator name to each certification
  const certificationsWithDetails = expiringCertifications.map((cert) => {
    const daysUntilExpiry = cert.expiryDate
      ? Math.ceil((cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Determine urgency level
    let urgency: 'critical' | 'warning' | 'notice' = 'notice'
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= 7) {
        urgency = 'critical'
      } else if (daysUntilExpiry <= 14) {
        urgency = 'warning'
      }
    }

    return {
      id: cert.id,
      operatorId: cert.operatorId,
      operatorName: `${cert.operatorFirstName} ${cert.operatorLastName}`,
      operatorEmail: cert.operatorEmail,
      certificationName: cert.certificationName,
      certificationNumber: cert.certificationNumber,
      issuer: cert.issuer,
      issuedDate: cert.issuedDate,
      expiryDate: cert.expiryDate,
      documentUrl: cert.documentUrl,
      isActive: cert.isActive,
      createdAt: cert.createdAt,
      updatedAt: cert.updatedAt,
      daysUntilExpiry,
      urgency,
    }
  })

  return {
    data: certificationsWithDetails,
    count: certificationsWithDetails.length,
    days: result.data.days,
  }
})
