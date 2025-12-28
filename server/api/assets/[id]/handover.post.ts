import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../../db/schema/roles'
import {
  type CertificationWarning,
  getOrganisationCertificationEnforcement,
  validateOperatorCertifications,
} from '../../../utils/certification-validator'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

const handoverSchema = z.object({
  // New operator to hand over to
  newOperatorId: z.string().uuid('Invalid operator ID'),
  // Handover details
  handoverType: z.enum(['shift_change', 'break', 'emergency', 'other']).default('shift_change'),
  handoverReason: z.string().max(1000).optional().nullable(),
  // Current operator's end readings
  endOdometer: z.number().min(0).optional().nullable(),
  endHours: z.number().min(0).optional().nullable(),
  endLatitude: z.number().min(-90).max(90).optional().nullable(),
  endLongitude: z.number().min(-180).max(180).optional().nullable(),
  endLocationName: z.string().max(255).optional().nullable(),
  // New operator's start readings (optional - defaults to current operator's end readings)
  startOdometer: z.number().min(0).optional().nullable(),
  startHours: z.number().min(0).optional().nullable(),
  startLatitude: z.number().min(-90).max(90).optional().nullable(),
  startLongitude: z.number().min(-180).max(180).optional().nullable(),
  startLocationName: z.string().max(255).optional().nullable(),
  // Session notes
  notes: z.string().max(1000).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  // Require assets:write permission (operators can hand over to other operators)
  const user = await requirePermission(event, 'assets:write')

  const assetId = getRouterParam(event, 'id')

  if (!assetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset ID is required',
    })
  }

  const body = await readBody(event)
  const result = handoverSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Find the current active session for this asset
  const currentSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.assetId, assetId),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  if (!currentSession) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No active session found on this asset',
    })
  }

  // Only allow the current operator or admin to hand over
  if (currentSession.operatorId !== user.id && !user.permissions.includes('*')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the current operator or admin can perform handover',
    })
  }

  // Verify the new operator exists and belongs to the same organisation
  const newOperator = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, data.newOperatorId),
      eq(schema.users.organisationId, user.organisationId),
      eq(schema.users.isActive, true),
    ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  if (!newOperator) {
    throw createError({
      statusCode: 404,
      statusMessage: 'New operator not found or inactive',
    })
  }

  // Cannot handover to yourself
  if (currentSession.operatorId === data.newOperatorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot hand over to yourself',
    })
  }

  // Check if new operator already has an active session on any asset
  const existingOperatorSession = await db.query.operatorSessions.findFirst({
    where: and(
      eq(schema.operatorSessions.operatorId, data.newOperatorId),
      eq(schema.operatorSessions.status, 'active'),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
        },
      },
    },
  })

  if (existingOperatorSession) {
    throw createError({
      statusCode: 409,
      statusMessage: `The new operator already has an active session on asset ${existingOperatorSession.asset.assetNumber}`,
      data: {
        existingSessionId: existingOperatorSession.id,
        assetId: existingOperatorSession.assetId,
        assetNumber: existingOperatorSession.asset.assetNumber,
      },
    })
  }

  // Validate new operator's certifications
  const certificationResult = await validateOperatorCertifications(
    data.newOperatorId,
    assetId,
    user.organisationId,
  )

  let certificationWarnings: CertificationWarning[] | undefined

  if (!certificationResult.valid) {
    const enforcementMode = await getOrganisationCertificationEnforcement(user.organisationId)

    if (enforcementMode === 'block') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Certification requirements not met for new operator',
        data: {
          certificationIssues: certificationResult.warnings,
          message:
            'The new operator cannot operate this asset due to missing or expired certifications.',
        },
      })
    }

    certificationWarnings = certificationResult.warnings
  }

  // Get organisation settings for handover threshold
  const organisation = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, user.organisationId),
    columns: {
      handoverThresholdMinutes: true,
    },
  })

  const handoverThresholdMinutes = organisation?.handoverThresholdMinutes ?? 30
  const endTime = new Date()

  // Calculate session gap and determine if this is a linked session
  const sessionGap = 0 // Gap is 0 for immediate handover
  const isLinkedSession = sessionGap <= handoverThresholdMinutes

  // Perform the handover transaction
  const handoverResult = await db.transaction(async (tx) => {
    const startTime = new Date(currentSession.startTime)
    const tripDurationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // Calculate trip distance if odometer readings available
    let tripDistance: number | null = null
    if (data.endOdometer != null && currentSession.startOdometer != null) {
      const startOdo = parseFloat(currentSession.startOdometer)
      tripDistance = data.endOdometer - startOdo
      if (tripDistance < 0) tripDistance = 0
    }

    // 1. End the current session
    const [endedSession] = await tx
      .update(schema.operatorSessions)
      .set({
        endTime,
        endOdometer: data.endOdometer?.toString() ?? null,
        endHours: data.endHours?.toString() ?? null,
        endLatitude: data.endLatitude?.toString() ?? null,
        endLongitude: data.endLongitude?.toString() ?? null,
        endLocationName: data.endLocationName ?? null,
        tripDistance: tripDistance?.toString() ?? null,
        tripDurationMinutes,
        status: 'completed',
        notes: data.notes ?? currentSession.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.operatorSessions.id, currentSession.id))
      .returning()

    // 2. Create new session for the new operator with handover link
    // Use the end readings as start readings if not explicitly provided
    const newStartOdometer = data.startOdometer ?? data.endOdometer
    const newStartHours = data.startHours ?? data.endHours
    const newStartLatitude = data.startLatitude ?? data.endLatitude
    const newStartLongitude = data.startLongitude ?? data.endLongitude
    const newStartLocationName = data.startLocationName ?? data.endLocationName

    const [newSession] = await tx
      .insert(schema.operatorSessions)
      .values({
        organisationId: user.organisationId,
        assetId,
        operatorId: data.newOperatorId,
        startTime: new Date(),
        startOdometer: newStartOdometer?.toString() ?? null,
        startHours: newStartHours?.toString() ?? null,
        startLatitude: newStartLatitude?.toString() ?? null,
        startLongitude: newStartLongitude?.toString() ?? null,
        startLocationName: newStartLocationName ?? null,
        status: 'active',
        syncStatus: 'synced',
        // Handover fields
        handoverFromSessionId: currentSession.id,
        handoverReason: data.handoverReason ?? null,
        handoverType: data.handoverType,
        sessionGap,
        isLinkedSession,
      })
      .returning()

    // 3. Log audit entry for handover
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'shift_handover',
      entityType: 'operator_session',
      entityId: newSession!.id,
      oldValues: {
        previousSessionId: currentSession.id,
        previousOperatorId: currentSession.operatorId,
        previousOperatorName: `${currentSession.operator.firstName} ${currentSession.operator.lastName}`,
      },
      newValues: {
        newSessionId: newSession!.id,
        newOperatorId: data.newOperatorId,
        newOperatorName: `${newOperator.firstName} ${newOperator.lastName}`,
        assetId,
        assetNumber: asset.assetNumber,
        handoverType: data.handoverType,
        handoverReason: data.handoverReason,
        sessionGap,
        isLinkedSession,
      },
    })

    // 4. Update asset with new readings if provided
    if (newStartOdometer || newStartHours) {
      const assetUpdate: Record<string, unknown> = { updatedAt: new Date() }
      if (newStartOdometer) {
        assetUpdate.mileage = newStartOdometer.toString()
      }
      if (newStartHours) {
        assetUpdate.operationalHours = newStartHours.toString()
      }
      await tx.update(schema.assets).set(assetUpdate).where(eq(schema.assets.id, assetId))
    }

    // 5. Update asset location if GPS coordinates provided
    if (newStartLatitude && newStartLongitude) {
      await tx
        .update(schema.assets)
        .set({
          latitude: newStartLatitude.toString(),
          longitude: newStartLongitude.toString(),
          locationName: newStartLocationName ?? undefined,
          lastLocationUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.assets.id, assetId))

      await tx.insert(schema.assetLocationHistory).values({
        assetId,
        latitude: newStartLatitude.toString(),
        longitude: newStartLongitude.toString(),
        locationName: newStartLocationName ?? null,
        source: 'shift_handover',
        updatedById: user.id,
        recordedAt: new Date(),
      })
    }

    // 6. Notify supervisors about the handover
    const supervisors = await tx.query.users.findMany({
      where: and(
        eq(schema.users.organisationId, user.organisationId),
        eq(schema.users.isActive, true),
        inArray(
          schema.users.roleId,
          tx
            .select({ id: schema.roles.id })
            .from(schema.roles)
            .where(
              inArray(schema.roles.name, [ROLES.SUPERVISOR, ROLES.FLEET_MANAGER, ROLES.ADMIN]),
            ),
        ),
      ),
      columns: {
        id: true,
      },
    })

    // Create notifications for supervisors
    if (supervisors.length > 0) {
      const handoverTypeLabels: Record<string, string> = {
        shift_change: 'Shift Change',
        break: 'Break',
        emergency: 'Emergency',
        other: 'Other',
      }

      await tx.insert(schema.notifications).values(
        supervisors.map((supervisor) => ({
          organisationId: user.organisationId,
          userId: supervisor.id,
          type: 'shift_handover' as const,
          title: `Shift Handover on ${asset.assetNumber}`,
          body: `${currentSession.operator.firstName} ${currentSession.operator.lastName} handed over to ${newOperator.firstName} ${newOperator.lastName} (${handoverTypeLabels[data.handoverType]})`,
          link: `/assets/${assetId}?tab=sessions`,
        })),
      )
    }

    return { endedSession: endedSession!, newSession: newSession! }
  })

  // Fetch the new session with relations
  const newSessionWithRelations = await db.query.operatorSessions.findFirst({
    where: eq(schema.operatorSessions.id, handoverResult.newSession.id),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          imageUrl: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      handoverFromSession: {
        columns: {
          id: true,
          startTime: true,
          endTime: true,
          tripDurationMinutes: true,
        },
        with: {
          operator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  // Build response
  const response: {
    success: boolean
    message: string
    previousSession: {
      id: string
      operator: { id: string; firstName: string; lastName: string }
      tripDurationMinutes: number | null
    }
    newSession: typeof newSessionWithRelations
    handover: {
      type: string
      reason: string | null
      sessionGap: number
      isLinkedSession: boolean
    }
    certificationWarnings?: CertificationWarning[]
  } = {
    success: true,
    message: `Successfully handed over asset ${asset.assetNumber} from ${currentSession.operator.firstName} ${currentSession.operator.lastName} to ${newOperator.firstName} ${newOperator.lastName}`,
    previousSession: {
      id: currentSession.id,
      operator: currentSession.operator,
      tripDurationMinutes: handoverResult.endedSession.tripDurationMinutes,
    },
    newSession: newSessionWithRelations,
    handover: {
      type: data.handoverType,
      reason: data.handoverReason ?? null,
      sessionGap,
      isLinkedSession,
    },
  }

  if (certificationWarnings && certificationWarnings.length > 0) {
    response.certificationWarnings = certificationWarnings
    response.message += ' (with certification warnings)'
  }

  return response
})
