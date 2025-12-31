<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

const { canWriteSettings, isAdmin } = usePermissions()
const toast = useToast()

// Interface for system settings from API
interface SystemSetting {
  id: string | null
  key: string
  value: unknown
  description: string | null
  category: string
  updatedAt: string | null
  updatedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  isDefault: boolean
}

interface SettingsResponse {
  settings: SystemSetting[]
  grouped: Record<string, SystemSetting[]>
}

// Fetch all settings
const {
  data: settingsData,
  refresh,
  status,
} = await useFetch<SettingsResponse>('/api/admin/settings', {
  default: (): SettingsResponse => ({
    settings: [],
    grouped: {},
  }),
})

// Category metadata for display
const categoryInfo: Record<string, { label: string; icon: string; description: string }> = {
  maintenance: {
    label: 'Maintenance',
    icon: 'i-lucide-wrench',
    description: 'Settings related to maintenance schedules and work orders.',
  },
  approval: {
    label: 'Approvals',
    icon: 'i-lucide-check-circle',
    description: 'Configure work order approval workflows and thresholds.',
  },
  certification: {
    label: 'Certifications',
    icon: 'i-lucide-award',
    description: 'Operator certification and pre-start check requirements.',
  },
  fuel: {
    label: 'Fuel Management',
    icon: 'i-lucide-fuel',
    description: 'Fuel tracking and variance alert settings.',
  },
  notifications: {
    label: 'Notifications',
    icon: 'i-lucide-bell',
    description: 'Email and in-app notification preferences.',
  },
  general: {
    label: 'General',
    icon: 'i-lucide-settings',
    description: 'General system configuration options.',
  },
}

// Categories in display order
const categoryOrder = [
  'maintenance',
  'approval',
  'certification',
  'fuel',
  'notifications',
  'general',
]

// State for editing
const editingKey = ref<string | null>(null)
const editingValue = ref<string | number | boolean>(false)
const isSaving = ref(false)

// Get input type based on value type
function getInputType(value: unknown): 'number' | 'boolean' | 'text' {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'text'
}

// Format value for display
function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

// Format key for display
function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Start editing a setting
function startEdit(setting: SystemSetting) {
  if (!canWriteSettings.value) return
  editingKey.value = setting.key
  // Ensure proper type assignment
  const val = setting.value
  if (typeof val === 'boolean') {
    editingValue.value = val
  } else if (typeof val === 'number') {
    editingValue.value = val
  } else if (typeof val === 'string') {
    editingValue.value = val
  } else {
    // For complex types, stringify them
    editingValue.value = JSON.stringify(val)
  }
}

// Cancel editing
function cancelEdit() {
  editingKey.value = null
  editingValue.value = false
}

// Save setting
async function saveSetting(setting: SystemSetting) {
  if (!canWriteSettings.value) return

  isSaving.value = true
  try {
    await $fetch(`/api/admin/settings/${setting.key}`, {
      method: 'PUT',
      body: { value: editingValue.value },
    })

    toast.add({
      title: 'Setting saved',
      description: `${formatKey(setting.key)} has been updated.`,
      icon: 'i-lucide-check',
      color: 'success',
    })

    await refresh()
    cancelEdit()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save setting'
    toast.add({
      title: 'Error',
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// Reset to default value
async function resetToDefault(setting: SystemSetting) {
  if (!canWriteSettings.value) return

  // Find the default value from our settings data
  const defaultSettings = [
    { key: 'maintenance_schedule_default_interval', value: 90 },
    { key: 'approval_threshold_amount', value: 500 },
    { key: 'certification_expiry_warning_days', value: 30 },
    { key: 'pre_start_check_required', value: true },
    { key: 'fuel_variance_threshold_percent', value: 15 },
    { key: 'notification_email_enabled', value: true },
    { key: 'document_expiry_warning_days', value: 14 },
    { key: 'max_work_order_attachments', value: 10 },
  ]

  const defaultValue = defaultSettings.find((s) => s.key === setting.key)?.value
  if (defaultValue === undefined) return

  isSaving.value = true
  try {
    await $fetch(`/api/admin/settings/${setting.key}`, {
      method: 'PUT',
      body: { value: defaultValue },
    })

    toast.add({
      title: 'Setting reset',
      description: `${formatKey(setting.key)} has been reset to default.`,
      icon: 'i-lucide-refresh-cw',
      color: 'info',
    })

    await refresh()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset setting'
    toast.add({
      title: 'Error',
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// Format the last updated info
function formatUpdatedInfo(setting: SystemSetting): string {
  if (setting.isDefault || !setting.updatedAt || !setting.updatedBy) {
    return 'Using default value'
  }

  const date = new Date(setting.updatedAt)
  const formattedDate = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  return `Updated ${formattedDate} by ${setting.updatedBy.firstName} ${setting.updatedBy.lastName}`
}
</script>

<template>
  <UDashboardPanel id="admin-settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="System Configuration">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-8 w-full lg:max-w-4xl mx-auto px-4 lg:px-0">
        <UPageCard
          title="System Settings"
          description="Configure global system settings for your organisation. These settings affect how the system behaves across all users."
          variant="naked"
          orientation="horizontal"
        />

        <PermissionGate permission="settings:read" not>
          <UAlert
            icon="i-lucide-lock"
            color="warning"
            variant="soft"
            title="Access Restricted"
            description="You don't have permission to view system settings."
          />
        </PermissionGate>

        <div v-if="status === 'pending'" class="p-8 text-center text-muted">
          Loading system settings...
        </div>

        <template v-else-if="settingsData?.grouped">
          <div v-for="category in categoryOrder" :key="category" class="space-y-4">
            <template v-if="settingsData.grouped[category]?.length">
              <div class="flex items-center gap-3 pt-4">
                <UIcon :name="categoryInfo[category]?.icon || 'i-lucide-settings'" class="w-5 h-5 text-primary" />
                <div>
                  <h2 class="text-lg font-semibold text-highlighted">
                    {{ categoryInfo[category]?.label || category }}
                  </h2>
                  <p class="text-sm text-muted">
                    {{ categoryInfo[category]?.description }}
                  </p>
                </div>
              </div>

              <UPageCard variant="subtle">
                <div class="divide-y divide-default">
                  <div
                    v-for="setting in settingsData.grouped[category]"
                    :key="setting.key"
                    class="py-4 first:pt-0 last:pb-0"
                  >
                    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="text-sm font-medium text-highlighted">
                            {{ formatKey(setting.key) }}
                          </p>
                          <UBadge v-if="setting.isDefault" color="neutral" variant="subtle" size="xs">
                            Default
                          </UBadge>
                        </div>
                        <p class="text-sm text-muted mt-1">
                          {{ setting.description }}
                        </p>
                        <p class="text-xs text-muted mt-2">
                          {{ formatUpdatedInfo(setting) }}
                        </p>
                      </div>

                      <div class="flex items-center gap-3">
                        <!-- Editing mode -->
                        <template v-if="editingKey === setting.key">
                          <template v-if="getInputType(setting.value) === 'boolean'">
                            <USwitch
                              :model-value="editingValue === true"
                              :disabled="!canWriteSettings"
                              @update:model-value="editingValue = $event"
                            />
                          </template>
                          <template v-else-if="getInputType(setting.value) === 'number'">
                            <UInput
                              :model-value="String(editingValue)"
                              type="number"
                              class="w-24"
                              :disabled="!canWriteSettings"
                              @update:model-value="editingValue = Number($event)"
                            />
                          </template>
                          <template v-else>
                            <UInput
                              :model-value="String(editingValue)"
                              type="text"
                              class="w-48"
                              :disabled="!canWriteSettings"
                              @update:model-value="editingValue = $event"
                            />
                          </template>

                          <UButton
                            icon="i-lucide-check"
                            color="primary"
                            variant="soft"
                            size="sm"
                            :loading="isSaving"
                            @click="saveSetting(setting)"
                          />
                          <UButton
                            icon="i-lucide-x"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :disabled="isSaving"
                            @click="cancelEdit"
                          />
                        </template>

                        <!-- Display mode -->
                        <template v-else>
                          <template v-if="getInputType(setting.value) === 'boolean'">
                            <USwitch
                              :model-value="setting.value as boolean"
                              :disabled="true"
                            />
                          </template>
                          <template v-else>
                            <UBadge color="neutral" variant="subtle" size="lg">
                              {{ formatValue(setting.value) }}
                            </UBadge>
                          </template>

                          <PermissionGate permission="settings:write">
                            <div class="flex items-center gap-1">
                              <UButton
                                icon="i-lucide-pencil"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="startEdit(setting)"
                              />
                              <UButton
                                v-if="!setting.isDefault"
                                icon="i-lucide-refresh-cw"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                title="Reset to default"
                                @click="resetToDefault(setting)"
                              />
                            </div>
                          </PermissionGate>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </UPageCard>
            </template>
          </div>
        </template>

        <UAlert
          v-else
          icon="i-lucide-info"
          color="info"
          variant="soft"
          title="No settings found"
          description="System settings will appear here once they are configured."
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
