import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import { DEFAULT_SYSTEM_SETTINGS } from '../../../db/schema/system-settings'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

// Schema for updating a system setting
const updateSettingSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown()),
  ]),
  description: z.string().optional(),
})

/**
 * US-17.4: Update a specific system setting
 * PUT /api/admin/settings/:key
 * Requires settings:write permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:write')
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Setting key is required',
    })
  }

  const body = await readBody(event)
  const parseResult = updateSettingSchema.safeParse(body)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request body',
      data: parseResult.error.flatten(),
    })
  }

  const { value, description } = parseResult.data

  // Check if setting exists in database
  const existingSetting = await db.query.systemSettings.findFirst({
    where: and(
      eq(schema.systemSettings.organisationId, user.organisationId),
      eq(schema.systemSettings.key, key),
    ),
  })

  // Find default setting info
  const defaultSetting = DEFAULT_SYSTEM_SETTINGS.find((s) => s.key === key)

  if (existingSetting) {
    // Update existing setting
    const result = await db
      .update(schema.systemSettings)
      .set({
        value,
        description: description ?? existingSetting.description,
        updatedAt: new Date(),
        updatedById: user.id,
      })
      .where(eq(schema.systemSettings.id, existingSetting.id))
      .returning()

    const updated = result[0]
    if (!updated) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'Failed to update setting',
      })
    }

    // Log the update
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entityType: 'system_setting',
      entityId: updated.id,
      oldValues: { key, value: existingSetting.value },
      newValues: { key, value },
    })

    return {
      id: updated.id,
      key: updated.key,
      value: updated.value,
      description: updated.description,
      category: updated.category,
      updatedAt: updated.updatedAt,
      updatedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      isDefault: false,
    }
  }

  // Create new setting if it doesn't exist
  if (!defaultSetting) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `Unknown setting key "${key}". Only known settings can be created.`,
    })
  }

  // Insert new setting based on default
  const result = await db
    .insert(schema.systemSettings)
    .values({
      organisationId: user.organisationId,
      key,
      value,
      description: description ?? defaultSetting.description,
      category: defaultSetting.category,
      updatedById: user.id,
    })
    .returning()

  const created = result[0]
  if (!created) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to create setting',
    })
  }

  // Log the creation
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'system_setting',
    entityId: created.id,
    oldValues: { key, value: defaultSetting.value, isDefault: true },
    newValues: { key, value },
  })

  return {
    id: created.id,
    key: created.key,
    value: created.value,
    description: created.description,
    category: created.category,
    updatedAt: created.updatedAt,
    updatedBy: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    isDefault: false,
  }
})
