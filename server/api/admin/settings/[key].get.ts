import { and, eq } from 'drizzle-orm'
import { DEFAULT_SYSTEM_SETTINGS } from '../../../db/schema/system-settings'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

/**
 * US-17.4: Get a specific system setting by key
 * GET /api/admin/settings/:key
 * Requires settings:read permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:read')
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Setting key is required',
    })
  }

  // Try to find the setting in the database
  const setting = await db.query.systemSettings.findFirst({
    where: and(
      eq(schema.systemSettings.organisationId, user.organisationId),
      eq(schema.systemSettings.key, key),
    ),
    with: {
      updatedBy: true,
    },
  })

  if (setting) {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      description: setting.description,
      category: setting.category,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy
        ? {
            id: setting.updatedBy.id,
            firstName: setting.updatedBy.firstName,
            lastName: setting.updatedBy.lastName,
          }
        : null,
      isDefault: false,
    }
  }

  // Check if this is a known default setting
  const defaultSetting = DEFAULT_SYSTEM_SETTINGS.find((s) => s.key === key)

  if (defaultSetting) {
    return {
      id: null,
      key: defaultSetting.key,
      value: defaultSetting.value,
      description: defaultSetting.description,
      category: defaultSetting.category,
      updatedAt: null,
      updatedBy: null,
      isDefault: true,
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    message: `Setting with key "${key}" not found`,
  })
})
