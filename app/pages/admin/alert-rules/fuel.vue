<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface FuelAlertSettings {
  id: string | null
  highConsumptionThreshold: number
  lowConsumptionThreshold: number
  criticalThreshold: number
  minDistanceBetweenRefuels: number
  enableHighConsumptionAlerts: boolean
  enableLowConsumptionAlerts: boolean
  enableRefuelWithoutDistanceAlerts: boolean
  enableMissingOdometerAlerts: boolean
  sendEmailNotifications: boolean
  sendInAppNotifications: boolean
  notes: string | null
}

const toast = useToast()
const isSaving = ref(false)

// Fetch settings
const {
  data: settings,
  status,
  refresh,
} = await useFetch<FuelAlertSettings>('/api/fuel/alert-settings', {
  default: () => ({
    id: null,
    highConsumptionThreshold: 30,
    lowConsumptionThreshold: 30,
    criticalThreshold: 50,
    minDistanceBetweenRefuels: 10,
    enableHighConsumptionAlerts: true,
    enableLowConsumptionAlerts: true,
    enableRefuelWithoutDistanceAlerts: true,
    enableMissingOdometerAlerts: true,
    sendEmailNotifications: false,
    sendInAppNotifications: true,
    notes: null,
  }),
})

// Form state
const formState = ref<FuelAlertSettings>({
  id: null,
  highConsumptionThreshold: 30,
  lowConsumptionThreshold: 30,
  criticalThreshold: 50,
  minDistanceBetweenRefuels: 10,
  enableHighConsumptionAlerts: true,
  enableLowConsumptionAlerts: true,
  enableRefuelWithoutDistanceAlerts: true,
  enableMissingOdometerAlerts: true,
  sendEmailNotifications: false,
  sendInAppNotifications: true,
  notes: null,
})

// Sync form state with fetched data
watch(
  settings,
  (newSettings) => {
    if (newSettings) {
      formState.value = { ...newSettings }
    }
  },
  { immediate: true },
)

// Save settings
async function saveSettings() {
  isSaving.value = true
  try {
    await $fetch('/api/fuel/alert-settings', {
      method: 'PUT',
      body: formState.value,
    })
    toast.add({
      title: 'Settings saved',
      description: 'Fuel alert settings have been updated.',
      color: 'success',
    })
    await refresh()
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.add({
      title: 'Failed to save',
      description: 'Could not save fuel alert settings. Please try again.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// Check if form has changes
const hasChanges = computed(() => {
  if (!settings.value) return false
  return JSON.stringify(formState.value) !== JSON.stringify(settings.value)
})
</script>

<template>
  <UDashboardPanel id="fuel-alert-settings">
    <template #header>
      <UDashboardNavbar title="Fuel Alert Settings">
        <template #leading>
          <UButton
            to="/admin/alert-rules"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            class="mr-2"
          />
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            color="primary"
            :loading="isSaving"
            :disabled="!hasChanges"
            icon="i-lucide-save"
            @click="saveSettings"
          >
            Save Changes
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else class="space-y-8 max-w-2xl">
        <!-- Thresholds Section -->
        <UPageCard
          title="Detection Thresholds"
          description="Configure the percentage thresholds for detecting fuel anomalies"
          variant="subtle"
        >
          <div class="space-y-6">
            <UFormField
              name="highConsumptionThreshold"
              label="High Consumption Threshold"
              description="Percentage above average consumption to trigger a warning"
            >
              <div class="flex items-center gap-3">
                <UInput
                  v-model.number="formState.highConsumptionThreshold"
                  type="number"
                  min="1"
                  max="200"
                  step="5"
                  class="w-24"
                />
                <span class="text-muted">%</span>
              </div>
            </UFormField>

            <UFormField
              name="lowConsumptionThreshold"
              label="Low Consumption Threshold"
              description="Percentage below average consumption to trigger a warning (possible recording error)"
            >
              <div class="flex items-center gap-3">
                <UInput
                  v-model.number="formState.lowConsumptionThreshold"
                  type="number"
                  min="1"
                  max="200"
                  step="5"
                  class="w-24"
                />
                <span class="text-muted">%</span>
              </div>
            </UFormField>

            <UFormField
              name="criticalThreshold"
              label="Critical Threshold"
              description="Escalates a warning to critical level when deviation exceeds this percentage"
            >
              <div class="flex items-center gap-3">
                <UInput
                  v-model.number="formState.criticalThreshold"
                  type="number"
                  min="1"
                  max="300"
                  step="5"
                  class="w-24"
                />
                <span class="text-muted">%</span>
              </div>
            </UFormField>

            <UFormField
              name="minDistanceBetweenRefuels"
              label="Minimum Distance Between Refuels"
              description="Trigger alert when a vehicle refuels with less than this distance traveled"
            >
              <div class="flex items-center gap-3">
                <UInput
                  v-model.number="formState.minDistanceBetweenRefuels"
                  type="number"
                  min="0"
                  max="1000"
                  step="5"
                  class="w-24"
                />
                <span class="text-muted">km</span>
              </div>
            </UFormField>
          </div>
        </UPageCard>

        <!-- Alert Types Section -->
        <UPageCard
          title="Alert Types"
          description="Enable or disable specific types of fuel anomaly alerts"
          variant="subtle"
        >
          <div class="space-y-4">
            <UFormField
              name="enableHighConsumptionAlerts"
              label="High Consumption Alerts"
              description="Alert when fuel consumption is significantly above average"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.enableHighConsumptionAlerts" />
            </UFormField>

            <UFormField
              name="enableLowConsumptionAlerts"
              label="Low Consumption Alerts"
              description="Alert when fuel consumption is unusually low (possible recording error)"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.enableLowConsumptionAlerts" />
            </UFormField>

            <UFormField
              name="enableRefuelWithoutDistanceAlerts"
              label="Refuel Without Distance Alerts"
              description="Alert when a vehicle refuels without significant distance traveled"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.enableRefuelWithoutDistanceAlerts" />
            </UFormField>

            <UFormField
              name="enableMissingOdometerAlerts"
              label="Missing Odometer Alerts"
              description="Alert when fuel transactions are recorded without odometer readings"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.enableMissingOdometerAlerts" />
            </UFormField>
          </div>
        </UPageCard>

        <!-- Notification Settings Section -->
        <UPageCard
          title="Notification Channels"
          description="Configure how you want to receive fuel anomaly alerts"
          variant="subtle"
        >
          <div class="space-y-4">
            <UFormField
              name="sendInAppNotifications"
              label="In-App Notifications"
              description="Show alerts in the notification center"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.sendInAppNotifications" />
            </UFormField>

            <UFormField
              name="sendEmailNotifications"
              label="Email Notifications"
              description="Send email notifications for fuel anomalies"
              class="flex items-center justify-between gap-4"
            >
              <USwitch v-model="formState.sendEmailNotifications" />
            </UFormField>
          </div>
        </UPageCard>

        <!-- Notes Section -->
        <UPageCard
          title="Notes"
          description="Add any notes about your fuel alert configuration"
          variant="subtle"
        >
          <UTextarea
            v-model="formState.notes"
            placeholder="e.g., Thresholds adjusted for fleet of diesel trucks..."
            :rows="3"
          />
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
