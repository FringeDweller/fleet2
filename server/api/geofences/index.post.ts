import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { validateCircleGeofence, validatePolygonCoordinates } from '../../utils/geofence-utils'
import { requirePermission } from '../../utils/permissions'

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const createGeofenceSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().optional().nullable(),
    type: z.enum(['polygon', 'circle']),
    category: z
      .enum(['work_site', 'depot', 'restricted_zone', 'customer_location', 'fuel_station', 'other'])
      .optional()
      .default('other'),
    // Circle properties
    centerLatitude: z.number().min(-90).max(90).optional().nullable(),
    centerLongitude: z.number().min(-180).max(180).optional().nullable(),
    radiusMeters: z.number().min(1).max(100000).optional().nullable(), // Max 100km radius
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
    isActive: z.boolean().optional().default(true),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .default('#3B82F6'),
  })
  .refine(
    (data) => {
      if (data.type === 'circle') {
        return validateCircleGeofence(data.centerLatitude, data.centerLongitude, data.radiusMeters)
      }
      return validatePolygonCoordinates(data.polygonCoordinates)
    },
    {
      message:
        'Invalid geofence geometry. Circle requires centerLatitude, centerLongitude, and radiusMeters. Polygon requires at least 3 valid coordinates.',
    },
  )

export default defineEventHandler(async (event) => {
  // Require assets:write permission to create geofences
  const user = await requirePermission(event, 'assets:write')

  const body = await readBody(event)
  const result = createGeofenceSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const [geofence] = await db
    .insert(schema.geofences)
    .values({
      organisationId: user.organisationId,
      name: result.data.name,
      description: result.data.description,
      type: result.data.type,
      category: result.data.category,
      centerLatitude: result.data.centerLatitude?.toString(),
      centerLongitude: result.data.centerLongitude?.toString(),
      radiusMeters: result.data.radiusMeters?.toString(),
      polygonCoordinates: result.data.polygonCoordinates,
      activeStartTime: result.data.activeStartTime,
      activeEndTime: result.data.activeEndTime,
      activeDays: result.data.activeDays,
      isActive: result.data.isActive,
      color: result.data.color,
    })
    .returning()

  if (!geofence) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create geofence',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'geofence',
    entityId: geofence.id,
    newValues: geofence,
  })

  return geofence
})
