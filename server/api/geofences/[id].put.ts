import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { validateCircleGeofence, validatePolygonCoordinates } from '../../utils/geofence-utils'
import { requirePermission } from '../../utils/permissions'

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const updateGeofenceSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional().nullable(),
    type: z.enum(['polygon', 'circle']).optional(),
    category: z
      .enum(['work_site', 'depot', 'restricted_zone', 'customer_location', 'fuel_station', 'other'])
      .optional(),
    // Circle properties
    centerLatitude: z.number().min(-90).max(90).optional().nullable(),
    centerLongitude: z.number().min(-180).max(180).optional().nullable(),
    radiusMeters: z.number().min(1).max(100000).optional().nullable(),
    // Polygon properties
    polygonCoordinates: z.array(coordinateSchema).min(3).optional().nullable(),
    // Active hours
    activeStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .optional()
      .nullable(),
    activeEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .optional()
      .nullable(),
    activeDays: z.array(z.number().min(0).max(6)).optional().nullable(),
    isActive: z.boolean().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  })
  .refine(
    (data) => {
      // Only validate geometry if type is being set or geometry fields are provided
      if (data.type === 'circle') {
        // If changing to circle, require all circle fields
        if (
          data.centerLatitude !== undefined ||
          data.centerLongitude !== undefined ||
          data.radiusMeters !== undefined
        ) {
          return validateCircleGeofence(
            data.centerLatitude,
            data.centerLongitude,
            data.radiusMeters,
          )
        }
      } else if (data.type === 'polygon') {
        // If changing to polygon, require polygon coordinates
        if (data.polygonCoordinates !== undefined) {
          return validatePolygonCoordinates(data.polygonCoordinates)
        }
      }
      return true
    },
    {
      message:
        'Invalid geofence geometry. Circle requires centerLatitude, centerLongitude, and radiusMeters. Polygon requires at least 3 valid coordinates.',
    },
  )

export default defineEventHandler(async (event) => {
  // Require assets:write permission to update geofences
  const user = await requirePermission(event, 'assets:write')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Geofence ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateGeofenceSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get existing geofence for audit log
  const existingGeofence = await db.query.geofences.findFirst({
    where: and(
      eq(schema.geofences.id, id),
      eq(schema.geofences.organisationId, user.organisationId),
    ),
  })

  if (!existingGeofence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Geofence not found',
    })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.name !== undefined) updateData.name = result.data.name
  if (result.data.description !== undefined) updateData.description = result.data.description
  if (result.data.type !== undefined) updateData.type = result.data.type
  if (result.data.category !== undefined) updateData.category = result.data.category
  if (result.data.centerLatitude !== undefined)
    updateData.centerLatitude = result.data.centerLatitude?.toString()
  if (result.data.centerLongitude !== undefined)
    updateData.centerLongitude = result.data.centerLongitude?.toString()
  if (result.data.radiusMeters !== undefined)
    updateData.radiusMeters = result.data.radiusMeters?.toString()
  if (result.data.polygonCoordinates !== undefined)
    updateData.polygonCoordinates = result.data.polygonCoordinates
  if (result.data.activeStartTime !== undefined)
    updateData.activeStartTime = result.data.activeStartTime
  if (result.data.activeEndTime !== undefined) updateData.activeEndTime = result.data.activeEndTime
  if (result.data.activeDays !== undefined) updateData.activeDays = result.data.activeDays
  if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive
  if (result.data.color !== undefined) updateData.color = result.data.color

  const [updatedGeofence] = await db
    .update(schema.geofences)
    .set(updateData)
    .where(
      and(eq(schema.geofences.id, id), eq(schema.geofences.organisationId, user.organisationId)),
    )
    .returning()

  // Log the update in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'geofence',
    entityId: id,
    oldValues: existingGeofence,
    newValues: updatedGeofence,
  })

  return updatedGeofence
})
