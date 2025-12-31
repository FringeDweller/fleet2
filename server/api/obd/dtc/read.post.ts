/**
 * Read DTCs endpoint (US-10.3)
 *
 * Records DTCs read from an OBD-II device and stores them in the asset's history.
 * Supports offline sync with timestamp parameter.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'
import { getDtcCodeType, lookupDtcCode } from '../../../utils/dtc-codes'

interface ReadDtcPayload {
  assetId: string
  codes: Array<{
    code: string
    description?: string
    severity?: 'info' | 'warning' | 'critical'
    system?: string
    possibleCauses?: string[]
  }>
  rawResponse?: string
  offlineTimestamp?: string
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Store user reference after auth check
  const user = session.user

  const body = await readBody<ReadDtcPayload>(event)

  if (!body.assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  if (!body.codes || !Array.isArray(body.codes)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Codes array is required',
    })
  }

  // Verify asset exists and belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, body.assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
    columns: { id: true, assetNumber: true },
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Determine read timestamp (for offline sync support)
  const readAt = body.offlineTimestamp ? new Date(body.offlineTimestamp) : new Date()

  // Store each DTC in the database
  const storedCodes = await Promise.all(
    body.codes.map(async (codeData) => {
      // Lookup additional info if not provided
      const lookupResult = lookupDtcCode(codeData.code)
      const codeType = getDtcCodeType(codeData.code)

      // Check if this code already exists as active (not cleared) for this asset
      const existingCode = await db.query.diagnosticCodes.findFirst({
        where: and(
          eq(schema.diagnosticCodes.assetId, body.assetId),
          eq(schema.diagnosticCodes.code, codeData.code.toUpperCase()),
          isNull(schema.diagnosticCodes.clearedAt),
        ),
      })

      if (existingCode) {
        // Update the existing record with new read timestamp
        const [updated] = await db
          .update(schema.diagnosticCodes)
          .set({
            rawResponse: body.rawResponse ?? existingCode.rawResponse,
            readAt,
            updatedAt: new Date(),
            syncStatus: body.offlineTimestamp ? 'synced' : 'synced',
          })
          .where(eq(schema.diagnosticCodes.id, existingCode.id))
          .returning()

        return updated
      }

      // Insert new DTC record
      const [newCode] = await db
        .insert(schema.diagnosticCodes)
        .values({
          organisationId: user.organisationId,
          assetId: body.assetId,
          code: codeData.code.toUpperCase(),
          codeType,
          description: codeData.description ?? lookupResult.description,
          severity: codeData.severity ?? lookupResult.severity,
          rawResponse: body.rawResponse ?? null,
          readAt,
          readByUserId: user.id,
          syncStatus: 'synced',
        })
        .returning()

      return newCode
    }),
  )

  // Fetch the stored codes with relations for response
  const codesWithRelations = await db.query.diagnosticCodes.findMany({
    where: and(
      eq(schema.diagnosticCodes.assetId, body.assetId),
      isNull(schema.diagnosticCodes.clearedAt),
    ),
    with: {
      readByUser: {
        columns: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: (dc, { desc }) => [desc(dc.readAt)],
  })

  // Log the action to audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'dtc_read',
    entityType: 'asset',
    entityId: body.assetId,
    newValues: {
      codesCount: body.codes.length,
      codes: body.codes.map((c) => c.code),
      assetNumber: asset.assetNumber,
    },
    ipAddress: getRequestIP(event) ?? null,
    userAgent: getRequestHeader(event, 'user-agent') ?? null,
  })

  return {
    success: true,
    codes: codesWithRelations,
    asset: { id: asset.id, assetNumber: asset.assetNumber },
    message: `${storedCodes.length} diagnostic code(s) recorded`,
  }
})
