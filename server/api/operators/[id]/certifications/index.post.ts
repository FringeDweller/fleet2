import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

const createCertificationSchema = z.object({
  certificationName: z.string().min(1, 'Certification name is required').max(100),
  certificationNumber: z.string().max(100).nullable().optional(),
  issuer: z.string().max(255).nullable().optional(),
  issuedDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  expiryDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  documentUrl: z.string().url().max(500).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  // Require users:write permission to add certifications
  const currentUser = await requirePermission(event, 'users:write')

  const operatorId = getRouterParam(event, 'id')
  if (!operatorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Operator ID is required',
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

  // Parse and validate request body
  const body = await readBody(event)
  const result = createCertificationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Validate expiry date is in the future if provided
  if (data.expiryDate) {
    const now = new Date()
    if (data.expiryDate <= now) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        data: {
          fieldErrors: {
            expiryDate: ['Expiry date must be in the future'],
          },
        },
      })
    }
  }

  // Create the certification
  const [certification] = await db
    .insert(schema.operatorCertifications)
    .values({
      organisationId: currentUser.organisationId,
      operatorId,
      certificationName: data.certificationName,
      certificationNumber: data.certificationNumber ?? null,
      issuer: data.issuer ?? null,
      issuedDate: data.issuedDate,
      expiryDate: data.expiryDate,
      documentUrl: data.documentUrl ?? null,
      isActive: true,
    })
    .returning()

  if (!certification) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create certification',
    })
  }

  // Log the creation in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'create',
    entityType: 'operator_certification',
    entityId: certification.id,
    oldValues: null,
    newValues: {
      operatorId,
      certificationName: data.certificationName,
      certificationNumber: data.certificationNumber,
      issuer: data.issuer,
      issuedDate: data.issuedDate?.toISOString(),
      expiryDate: data.expiryDate?.toISOString(),
      documentUrl: data.documentUrl,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    certification,
  }
})
