import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

const updateCertificationSchema = z.object({
  certificationName: z.string().min(1).max(100).optional(),
  certificationNumber: z.string().max(100).nullable().optional(),
  issuer: z.string().max(255).nullable().optional(),
  issuedDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? undefined : val ? new Date(val) : null)),
  expiryDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? undefined : val ? new Date(val) : null)),
  documentUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  // Require users:write permission to update certifications
  const currentUser = await requirePermission(event, 'users:write')

  const operatorId = getRouterParam(event, 'id')
  const certId = getRouterParam(event, 'certId')

  if (!operatorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Operator ID is required',
    })
  }

  if (!certId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Certification ID is required',
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

  // Verify the certification exists and belongs to this operator
  const existingCertification = await db.query.operatorCertifications.findFirst({
    where: and(
      eq(schema.operatorCertifications.id, certId),
      eq(schema.operatorCertifications.operatorId, operatorId),
      eq(schema.operatorCertifications.organisationId, currentUser.organisationId),
    ),
  })

  if (!existingCertification) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Certification not found',
    })
  }

  // Parse and validate request body
  const body = await readBody(event)
  const result = updateCertificationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.certificationName !== undefined) {
    updates.certificationName = data.certificationName
  }
  if (data.certificationNumber !== undefined) {
    updates.certificationNumber = data.certificationNumber
  }
  if (data.issuer !== undefined) {
    updates.issuer = data.issuer
  }
  if (data.issuedDate !== undefined) {
    updates.issuedDate = data.issuedDate
  }
  if (data.expiryDate !== undefined) {
    updates.expiryDate = data.expiryDate
  }
  if (data.documentUrl !== undefined) {
    updates.documentUrl = data.documentUrl
  }
  if (data.isActive !== undefined) {
    updates.isActive = data.isActive
  }

  // Store old values for audit log
  const oldValues = {
    certificationName: existingCertification.certificationName,
    certificationNumber: existingCertification.certificationNumber,
    issuer: existingCertification.issuer,
    issuedDate: existingCertification.issuedDate?.toISOString(),
    expiryDate: existingCertification.expiryDate?.toISOString(),
    documentUrl: existingCertification.documentUrl,
    isActive: existingCertification.isActive,
  }

  // Update the certification
  const [updatedCertification] = await db
    .update(schema.operatorCertifications)
    .set(updates)
    .where(eq(schema.operatorCertifications.id, certId))
    .returning()

  if (!updatedCertification) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update certification',
    })
  }

  // Log the update in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'update',
    entityType: 'operator_certification',
    entityId: certId,
    oldValues,
    newValues: {
      certificationName: updatedCertification.certificationName,
      certificationNumber: updatedCertification.certificationNumber,
      issuer: updatedCertification.issuer,
      issuedDate: updatedCertification.issuedDate?.toISOString(),
      expiryDate: updatedCertification.expiryDate?.toISOString(),
      documentUrl: updatedCertification.documentUrl,
      isActive: updatedCertification.isActive,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    certification: updatedCertification,
  }
})
