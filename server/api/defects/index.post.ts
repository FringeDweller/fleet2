import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES } from '../../db/schema/roles'
import { db, schema } from '../../utils/db'
import { createNotification } from '../../utils/notifications'

const createDefectSchema = z.object({
  assetId: z.string().uuid('Asset is required'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  severity: z.enum(['minor', 'major', 'critical']).default('minor'),
  location: z.string().max(255).optional().nullable(),
  photos: z.array(z.string()).optional().nullable(),
  autoCreateWorkOrder: z.boolean().default(true),
})

async function generateWorkOrderNumber(organisationId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.workOrders)
    .where(eq(schema.workOrders.organisationId, organisationId))

  const count = result[0]?.count ?? 0
  const nextNumber = count + 1
  return `WO-${nextNumber.toString().padStart(4, '0')}`
}

function mapSeverityToPriority(
  severity: 'minor' | 'major' | 'critical',
): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'major':
      return 'high'
    case 'minor':
      return 'medium'
    default:
      return 'medium'
  }
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  const body = await readBody(event)
  const result = createDefectSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify asset belongs to organisation
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(schema.assets.id, result.data.assetId),
      eq(schema.assets.organisationId, user.organisationId),
    ),
  })

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  // Create defect and optionally work order in a transaction
  const defectResult = await db.transaction(async (tx) => {
    let workOrderId: string | null = null
    let workOrder: typeof schema.workOrders.$inferSelect | null = null

    // Auto-create work order for major and critical defects (or if explicitly requested)
    const shouldCreateWorkOrder =
      result.data.autoCreateWorkOrder &&
      (result.data.severity === 'major' || result.data.severity === 'critical')

    if (shouldCreateWorkOrder) {
      const workOrderNumber = await generateWorkOrderNumber(user.organisationId)
      const priority = mapSeverityToPriority(result.data.severity)

      const [newWorkOrder] = await tx
        .insert(schema.workOrders)
        .values({
          organisationId: user.organisationId,
          workOrderNumber,
          assetId: result.data.assetId,
          createdById: user.id,
          title: `Defect: ${result.data.title}`,
          description:
            result.data.description ||
            `Defect reported: ${result.data.title}${result.data.location ? `\nLocation: ${result.data.location}` : ''}`,
          priority,
          status: 'open',
        })
        .returning()

      workOrder = newWorkOrder || null
      workOrderId = workOrder?.id || null

      // Create status history for work order
      if (workOrder) {
        await tx.insert(schema.workOrderStatusHistory).values({
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: 'open',
          changedById: user.id,
          notes: 'Auto-created from defect report',
        })

        // If defect has photos, copy them to work order
        if (result.data.photos && result.data.photos.length > 0) {
          await tx.insert(schema.workOrderPhotos).values(
            result.data.photos.map((photo) => ({
              workOrderId: workOrder!.id,
              photoUrl: photo,
              uploadedById: user.id,
              caption: 'From defect report',
            })),
          )
        }
      }
    }

    // Create the defect
    const [defect] = await tx
      .insert(schema.defects)
      .values({
        organisationId: user.organisationId,
        assetId: result.data.assetId,
        workOrderId,
        reportedById: user.id,
        title: result.data.title,
        description: result.data.description,
        category: result.data.category,
        severity: result.data.severity,
        location: result.data.location,
        photos: result.data.photos ? JSON.stringify(result.data.photos) : null,
      })
      .returning()

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'create',
      entityType: 'defect',
      entityId: defect!.id,
      newValues: defect,
    })

    if (workOrder) {
      await tx.insert(schema.auditLog).values({
        organisationId: user.organisationId,
        userId: user.id,
        action: 'create',
        entityType: 'work_order',
        entityId: workOrder.id,
        newValues: workOrder,
      })
    }

    return { defect: defect!, workOrder }
  })

  // Notify supervisors about the defect (outside transaction for non-critical operations)
  try {
    // Get supervisor role
    const supervisorRole = await db.query.roles.findFirst({
      where: eq(schema.roles.name, ROLES.SUPERVISOR),
    })

    if (supervisorRole) {
      // Get all supervisors in the organisation
      const supervisors = await db.query.users.findMany({
        where: and(
          eq(schema.users.organisationId, user.organisationId),
          eq(schema.users.roleId, supervisorRole.id),
          eq(schema.users.isActive, true),
        ),
      })

      // Notify each supervisor
      const reporterName = `${user.firstName} ${user.lastName}`
      for (const supervisor of supervisors) {
        if (supervisor.id !== user.id) {
          await createNotification({
            organisationId: user.organisationId,
            userId: supervisor.id,
            type: 'defect_reported',
            title: `${result.data.severity.charAt(0).toUpperCase() + result.data.severity.slice(1)} Defect Reported`,
            body: `${reporterName} reported a ${result.data.severity} defect on ${asset.assetNumber}: ${result.data.title}`,
            link: defectResult.workOrder
              ? `/work-orders/${defectResult.workOrder.id}`
              : `/assets/${asset.id}`,
            isRead: false,
          })
        }
      }
    }
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to send supervisor notifications:', error)
  }

  return {
    defect: defectResult.defect,
    workOrder: defectResult.workOrder,
  }
})
