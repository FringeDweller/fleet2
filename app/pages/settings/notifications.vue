<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

interface NotificationPreferences {
  id: string | null
  emailEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  workOrderAssigned: boolean
  workOrderStatusChanged: boolean
  workOrderApprovalRequested: boolean
  workOrderApproved: boolean
  workOrderRejected: boolean
  workOrderDueSoon: boolean
  workOrderOverdue: boolean
  geofenceAlerts: boolean
  fuelAnomalies: boolean
  documentExpiring: boolean
  defectReported: boolean
  shiftHandover: boolean
  systemNotifications: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  quietHoursDays: number[]
  emailDigestEnabled: boolean
  emailDigestFrequency: 'daily' | 'weekly' | 'never'
}

const toast = useToast()

// Default preferences when none exist
const defaultPreferences: NotificationPreferences = {
  id: null,
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  workOrderAssigned: true,
  workOrderStatusChanged: true,
  workOrderApprovalRequested: true,
  workOrderApproved: true,
  workOrderRejected: true,
  workOrderDueSoon: true,
  workOrderOverdue: true,
  geofenceAlerts: true,
  fuelAnomalies: true,
  documentExpiring: true,
  defectReported: true,
  shiftHandover: true,
  systemNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursDays: [0, 1, 2, 3, 4, 5, 6],
  emailDigestEnabled: false,
  emailDigestFrequency: 'daily',
}

// Fetch user's notification preferences
const { data: fetchedPrefs, status, refresh } = await useFetch('/api/user/notification-preferences')
const preferences = computed<NotificationPreferences>(() => {
  return (fetchedPrefs.value as NotificationPreferences) ?? defaultPreferences
})

const isSaving = ref(false)

// Debounced save function
const savePreferences = useDebounceFn(async (updates: Partial<NotificationPreferences>) => {
  isSaving.value = true
  try {
    await $fetch('/api/user/notification-preferences', {
      method: 'PUT',
      body: updates,
    })
    toast.add({
      title: 'Preferences saved',
      color: 'success',
    })
    await refresh()
  } catch (error) {
    console.error('Failed to save preferences:', error)
    toast.add({
      title: 'Failed to save',
      description: 'Your preferences could not be saved. Please try again.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}, 500)

// Handle toggle change
function handleChange(key: keyof NotificationPreferences, value: boolean | string | number[]) {
  // Update local state (via fetchedPrefs) and save to server
  if (fetchedPrefs.value) {
    ;(fetchedPrefs.value as Record<string, unknown>)[key] = value
  }
  savePreferences({ [key]: value })
}

// Section definitions
const channelSection = {
  title: 'Notification Channels',
  description: 'Choose how you want to receive notifications',
  fields: [
    {
      key: 'inAppEnabled' as const,
      label: 'In-App Notifications',
      description: 'Show notifications in the app notification center',
    },
    {
      key: 'pushEnabled' as const,
      label: 'Push Notifications',
      description: 'Receive push notifications on your mobile device',
    },
    {
      key: 'emailEnabled' as const,
      label: 'Email Notifications',
      description: 'Receive email notifications for important events',
    },
  ],
}

const workOrderSection = {
  title: 'Work Orders',
  description: 'Notifications about work orders and assignments',
  fields: [
    {
      key: 'workOrderAssigned' as const,
      label: 'Work Order Assigned',
      description: 'When a work order is assigned to you',
    },
    {
      key: 'workOrderStatusChanged' as const,
      label: 'Status Changes',
      description: 'When a work order status changes',
    },
    {
      key: 'workOrderApprovalRequested' as const,
      label: 'Approval Requests',
      description: 'When a work order requires your approval',
    },
    {
      key: 'workOrderApproved' as const,
      label: 'Approval Decisions',
      description: 'When your work order is approved or rejected',
    },
    {
      key: 'workOrderDueSoon' as const,
      label: 'Due Soon',
      description: 'When a work order is due soon',
    },
    {
      key: 'workOrderOverdue' as const,
      label: 'Overdue',
      description: 'When a work order becomes overdue',
    },
  ],
}

const monitoringSection = {
  title: 'Monitoring & Alerts',
  description: 'Notifications about asset monitoring and alerts',
  fields: [
    {
      key: 'geofenceAlerts' as const,
      label: 'Geofence Alerts',
      description: 'When vehicles enter or exit geofenced areas',
    },
    {
      key: 'fuelAnomalies' as const,
      label: 'Fuel Anomalies',
      description: 'When unusual fuel consumption is detected',
    },
    {
      key: 'documentExpiring' as const,
      label: 'Document Expiry',
      description: 'When documents are about to expire',
    },
    {
      key: 'defectReported' as const,
      label: 'Defects Reported',
      description: 'When new defects are reported on assets',
    },
  ],
}

const operatorSection = {
  title: 'Operator & Shift',
  description: 'Notifications about operators and shifts',
  fields: [
    {
      key: 'shiftHandover' as const,
      label: 'Shift Handover',
      description: 'When shift handover notifications occur',
    },
    {
      key: 'systemNotifications' as const,
      label: 'System Notifications',
      description: 'Important system announcements and updates',
    },
  ],
}

const digestFrequencyOptions = [
  { label: 'Daily digest', value: 'daily' },
  { label: 'Weekly digest', value: 'weekly' },
  { label: 'No digest', value: 'never' },
]

const dayOptions = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Saving indicator -->
      <div
        v-if="isSaving"
        class="fixed top-4 right-4 z-50 flex items-center gap-2 bg-default rounded-lg shadow-lg px-4 py-2"
      >
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        <span class="text-sm">Saving...</span>
      </div>

      <!-- Notification Channels -->
      <UPageCard
        :title="channelSection.title"
        :description="channelSection.description"
        variant="naked"
        class="mb-2"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          v-for="field in channelSection.fields"
          :key="field.key"
          :name="field.key"
          :label="field.label"
          :description="field.description"
          class="flex items-center justify-between not-last:pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.[field.key] ?? true"
            @update:model-value="handleChange(field.key, $event)"
          />
        </UFormField>
      </UPageCard>

      <!-- Work Orders -->
      <UPageCard
        :title="workOrderSection.title"
        :description="workOrderSection.description"
        variant="naked"
        class="mb-2 mt-6"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          v-for="field in workOrderSection.fields"
          :key="field.key"
          :name="field.key"
          :label="field.label"
          :description="field.description"
          class="flex items-center justify-between not-last:pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.[field.key] ?? true"
            @update:model-value="handleChange(field.key, $event)"
          />
        </UFormField>
      </UPageCard>

      <!-- Monitoring & Alerts -->
      <UPageCard
        :title="monitoringSection.title"
        :description="monitoringSection.description"
        variant="naked"
        class="mb-2 mt-6"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          v-for="field in monitoringSection.fields"
          :key="field.key"
          :name="field.key"
          :label="field.label"
          :description="field.description"
          class="flex items-center justify-between not-last:pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.[field.key] ?? true"
            @update:model-value="handleChange(field.key, $event)"
          />
        </UFormField>
      </UPageCard>

      <!-- Operator & Shift -->
      <UPageCard
        :title="operatorSection.title"
        :description="operatorSection.description"
        variant="naked"
        class="mb-2 mt-6"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          v-for="field in operatorSection.fields"
          :key="field.key"
          :name="field.key"
          :label="field.label"
          :description="field.description"
          class="flex items-center justify-between not-last:pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.[field.key] ?? true"
            @update:model-value="handleChange(field.key, $event)"
          />
        </UFormField>
      </UPageCard>

      <!-- Email Digest -->
      <UPageCard
        title="Email Digest"
        description="Receive a summary of notifications by email"
        variant="naked"
        class="mb-2 mt-6"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          name="emailDigestEnabled"
          label="Enable Email Digest"
          description="Receive a periodic summary of notifications"
          class="flex items-center justify-between pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.emailDigestEnabled ?? false"
            @update:model-value="handleChange('emailDigestEnabled', $event)"
          />
        </UFormField>

        <UFormField
          v-if="preferences?.emailDigestEnabled"
          name="emailDigestFrequency"
          label="Digest Frequency"
          description="How often to receive the digest"
          class="flex items-center justify-between pt-4 gap-2"
        >
          <USelectMenu
            :model-value="preferences?.emailDigestFrequency ?? 'daily'"
            :items="digestFrequencyOptions"
            value-key="value"
            class="w-40"
            @update:model-value="handleChange('emailDigestFrequency', $event)"
          />
        </UFormField>
      </UPageCard>

      <!-- Quiet Hours -->
      <UPageCard
        title="Quiet Hours"
        description="Pause notifications during specific hours"
        variant="naked"
        class="mb-2 mt-6"
      />
      <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
        <UFormField
          name="quietHoursEnabled"
          label="Enable Quiet Hours"
          description="Don't send push notifications during quiet hours"
          class="flex items-center justify-between pb-4 gap-2"
        >
          <USwitch
            :model-value="preferences?.quietHoursEnabled ?? false"
            @update:model-value="handleChange('quietHoursEnabled', $event)"
          />
        </UFormField>

        <template v-if="preferences?.quietHoursEnabled">
          <div class="flex items-center gap-4 pt-4">
            <UFormField name="quietHoursStart" label="Start" class="flex-1">
              <UInput
                type="time"
                :model-value="preferences?.quietHoursStart?.substring(0, 5) ?? '22:00'"
                @update:model-value="handleChange('quietHoursStart', $event + ':00')"
              />
            </UFormField>
            <UFormField name="quietHoursEnd" label="End" class="flex-1">
              <UInput
                type="time"
                :model-value="preferences?.quietHoursEnd?.substring(0, 5) ?? '07:00'"
                @update:model-value="handleChange('quietHoursEnd', $event + ':00')"
              />
            </UFormField>
          </div>

          <UFormField
            name="quietHoursDays"
            label="Active Days"
            description="Which days quiet hours should be active"
            class="pt-4"
          >
            <div class="flex flex-wrap gap-2 mt-2">
              <UButton
                v-for="day in dayOptions"
                :key="day.value"
                size="sm"
                :variant="preferences?.quietHoursDays?.includes(day.value) ? 'solid' : 'ghost'"
                :color="preferences?.quietHoursDays?.includes(day.value) ? 'primary' : 'neutral'"
                @click="
                  () => {
                    const days = preferences?.quietHoursDays ?? []
                    const newDays = days.includes(day.value)
                      ? days.filter((d: number) => d !== day.value)
                      : [...days, day.value].sort()
                    handleChange('quietHoursDays', newDays)
                  }
                "
              >
                {{ day.label }}
              </UButton>
            </div>
          </UFormField>
        </template>
      </UPageCard>
    </template>
  </div>
</template>
