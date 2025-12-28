import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require users:delete permission to delete certifications
  const currentUser = await requirePermission(event, 'users:delete')

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

  // Soft delete by setting isActive = false
  const [deletedCertification] = await db
    .update(schema.operatorCertifications)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.operatorCertifications.id, certId))
    .returning()

  if (!deletedCertification) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete certification',
    })
  }

  // Log the deletion in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'delete',
    entityType: 'operator_certification',
    entityId: certId,
    oldValues,
    newValues: {
      isActive: false,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    message: 'Certification deleted successfully',
  }
})
