import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

const querySchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined
      return val === 'true'
    }),
})

export default defineEventHandler(async (event) => {
  // Require users:read permission to list certifications
  const currentUser = await requirePermission(event, 'users:read')

  const operatorId = getRouterParam(event, 'id')
  if (!operatorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Operator ID is required',
    })
  }

  // Validate query parameters
  const query = getQuery(event)
  const result = querySchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify the operator exists and belongs to the same organisation
  const operator = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, operatorId),
      eq(schema.users.organisationId, currentUser.organisationId),
    ),
  })

  if (!operator) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Operator not found',
    })
  }

  // Build conditions for the query
  const conditions = [
    eq(schema.operatorCertifications.operatorId, operatorId),
    eq(schema.operatorCertifications.organisationId, currentUser.organisationId),
  ]

  // Add isActive filter if provided
  if (result.data.isActive !== undefined) {
    conditions.push(eq(schema.operatorCertifications.isActive, result.data.isActive))
  }

  // Fetch certifications for the operator
  const certifications = await db.query.operatorCertifications.findMany({
    where: and(...conditions),
    orderBy: (certifications, { asc }) => [asc(certifications.certificationName)],
  })

  // Add expiry status to each certification
  const now = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const certificationsWithStatus = certifications.map((cert) => {
    let expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry' = 'no_expiry'

    if (cert.expiryDate) {
      if (cert.expiryDate < now) {
        expiryStatus = 'expired'
      } else if (cert.expiryDate <= thirtyDaysFromNow) {
        expiryStatus = 'expiring_soon'
      } else {
        expiryStatus = 'valid'
      }
    }

    return {
      ...cert,
      expiryStatus,
      daysUntilExpiry: cert.expiryDate
        ? Math.ceil((cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }
  })

  return {
    data: certificationsWithStatus,
    count: certificationsWithStatus.length,
  }
})
