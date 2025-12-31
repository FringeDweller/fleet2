import { eq } from 'drizzle-orm'
import { DEFAULT_SYSTEM_SETTINGS } from '../../../db/schema/system-settings'
import { db, schema } from '../../../utils/db'
import { requirePermission } from '../../../utils/permissions'

// Common type for settings in the response
interface SettingResponse {
  id: string | null
  key: string
  value: unknown
  description: string | null
  category: string
  updatedAt: Date | null
  updatedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  isDefault: boolean
}

/**
 * US-17.4: Get all system settings for the current organisation
 * GET /api/admin/settings
 * Requires settings:read permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings:read')

  // Fetch existing settings from database
  const existingSettings = await db.query.systemSettings.findMany({
    where: eq(schema.systemSettings.organisationId, user.organisationId),
    with: {
      updatedBy: true,
    },
    orderBy: (settings, { asc }) => [asc(settings.category), asc(settings.key)],
  })

  // Build a map of existing settings by key
  const settingsMap = new Map(existingSettings.map((s) => [s.key, s]))

  // Merge with defaults (in case some settings don't exist yet)
  const allSettings: SettingResponse[] = DEFAULT_SYSTEM_SETTINGS.map((defaultSetting) => {
    const existing = settingsMap.get(defaultSetting.key)
    if (existing) {
      return {
        id: existing.id,
        key: existing.key,
        value: existing.value as unknown,
        description: existing.description || defaultSetting.description,
        category: existing.category,
        updatedAt: existing.updatedAt,
        updatedBy: existing.updatedBy
          ? {
              id: existing.updatedBy.id,
              firstName: existing.updatedBy.firstName,
              lastName: existing.updatedBy.lastName,
            }
          : null,
        isDefault: false,
      }
    }
    // Return default value if setting doesn't exist in database
    return {
      id: null,
      key: defaultSetting.key,
      value: defaultSetting.value as unknown,
      description: defaultSetting.description,
      category: defaultSetting.category,
      updatedAt: null,
      updatedBy: null,
      isDefault: true,
    }
  })

  // Include any custom settings that are not in defaults
  const defaultKeys = new Set(DEFAULT_SYSTEM_SETTINGS.map((s) => s.key))
  const customSettings: SettingResponse[] = existingSettings
    .filter((s) => !defaultKeys.has(s.key))
    .map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value as unknown,
      description: s.description,
      category: s.category,
      updatedAt: s.updatedAt,
      updatedBy: s.updatedBy
        ? {
            id: s.updatedBy.id,
            firstName: s.updatedBy.firstName,
            lastName: s.updatedBy.lastName,
          }
        : null,
      isDefault: false,
    }))

  // Group by category
  const categories = [
    'maintenance',
    'approval',
    'certification',
    'fuel',
    'notifications',
    'general',
  ] as const

  const combinedSettings = [...allSettings, ...customSettings]
  const groupedSettings = categories.reduce(
    (acc, category) => {
      acc[category] = combinedSettings.filter((s) => s.category === category)
      return acc
    },
    {} as Record<string, SettingResponse[]>,
  )

  return {
    settings: combinedSettings,
    grouped: groupedSettings,
  }
})
