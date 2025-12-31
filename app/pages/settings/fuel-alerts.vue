<script setup lang="ts">
/**
 * Fuel Alert Settings Page (US-11.5)
 *
 * Configure thresholds for fuel consumption anomaly detection.
 */

definePageMeta({
  middleware: 'auth',
})

interface FuelAlertSettings {
  id: string | null
  organisationId: string
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
  updatedAt: string | null
}

const toast = useToast()

// Fetch current settings
const {
  data: settings,
  status,
  refresh,
} = await useFetch<FuelAlertSettings>('/api/fuel/alert-settings', {
  lazy: true,
})

// Form state
const formData = ref({
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
  notes: '',
})

const isSubmitting = ref(false)
const hasChanges = ref(false)

// Watch for settings data to populate form
watch(
  settings,
  (newSettings) => {
    if (newSettings) {
      formData.value = {
        highConsumptionThreshold: newSettings.highConsumptionThreshold,
        lowConsumptionThreshold: newSettings.lowConsumptionThreshold,
        criticalThreshold: newSettings.criticalThreshold,
        minDistanceBetweenRefuels: newSettings.minDistanceBetweenRefuels,
        enableHighConsumptionAlerts: newSettings.enableHighConsumptionAlerts,
        enableLowConsumptionAlerts: newSettings.enableLowConsumptionAlerts,
        enableRefuelWithoutDistanceAlerts: newSettings.enableRefuelWithoutDistanceAlerts,
        enableMissingOdometerAlerts: newSettings.enableMissingOdometerAlerts,
        sendEmailNotifications: newSettings.sendEmailNotifications,
        sendInAppNotifications: newSettings.sendInAppNotifications,
        notes: newSettings.notes ?? '',
      }
      hasChanges.value = false
    }
  },
  { immediate: true },
)

// Track form changes
watch(
  formData,
  () => {
    hasChanges.value = true
  },
  { deep: true },
)

// Save settings
async function saveSettings() {
  isSubmitting.value = true

  try {
    await $fetch('/api/fuel/alert-settings', {
      method: 'PUT',
      body: {
        ...formData.value,
        notes: formData.value.notes || null,
      },
    })

    toast.add({
      title: 'Settings Saved',
      description: 'Fuel alert settings have been updated',
      color: 'success',
    })

    hasChanges.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to save settings',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

// Test anomaly detection
const isTestingAnomalies = ref(false)
const testResults = ref<{
  summary?: {
    transactionsAnalyzed: number
    consumptionCalculated: number
    highConsumptionCount: number
    lowConsumptionCount: number
    refuelWithoutDistanceCount: number
    missingOdometerCount: number
    criticalCount: number
    warningCount: number
  }
} | null>(null)

async function testAnomalyDetection() {
  isTestingAnomalies.value = true
  testResults.value = null

  try {
    const result = await $fetch('/api/fuel/check-anomalies', {
      method: 'POST',
      body: {
        dryRun: true, // Don't create notifications
      },
    })

    testResults.value = result
    toast.add({
      title: 'Test Complete',
      description: `Found ${result.summary.highConsumptionCount + result.summary.lowConsumptionCount} consumption anomalies`,
      color: 'info',
    })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to run test',
      color: 'error',
    })
  } finally {
    isTestingAnomalies.value = false
  }
}

// Format last updated
const lastUpdated = computed(() => {
  if (!settings.value?.updatedAt) return null
  return new Date(settings.value.updatedAt).toLocaleString()
})
</script>

<template>
  <UDashboardPanel id="fuel-alerts-settings">
    <template #header>
      <UDashboardNavbar title="Fuel Alert Settings">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/settings"
          />
        </template>
        <template #trailing>
          <UButton
            label="Save Changes"
            color="primary"
            :loading="isSubmitting"
            :disabled="!hasChanges"
            @click="saveSettings"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-3xl mx-auto py-6 px-4">
        <!-- Loading state -->
        <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>

        <template v-else>
          <!-- Info banner -->
          <UAlert
            color="info"
            icon="i-lucide-info"
            class="mb-6"
          >
            <template #title>Fuel Consumption Anomaly Detection</template>
            <template #description>
              Configure thresholds for detecting unusual fuel consumption patterns.
              Alerts are triggered when consumption deviates significantly from an asset's average.
            </template>
          </UAlert>

          <!-- Consumption Thresholds Section -->
          <UPageCard
            title="Consumption Thresholds"
            description="Set the deviation percentages that trigger alerts"
            variant="naked"
            class="mb-4"
          />

          <UPageCard variant="subtle" class="mb-6">
            <div class="space-y-6">
              <!-- High Consumption Threshold -->
              <UFormField
                label="High Consumption Warning Threshold"
                description="Alert when consumption exceeds average by this percentage"
              >
                <div class="flex items-center gap-4">
                  <UInput
                    v-model.number="formData.highConsumptionThreshold"
                    type="number"
                    min="1"
                    max="200"
                    class="w-32"
                  />
                  <span class="text-muted">%</span>
                  <span class="text-sm text-muted">
                    (e.g., 30% = alert if consumption is 30% higher than average)
                  </span>
                </div>
              </UFormField>

              <!-- Low Consumption Threshold -->
              <UFormField
                label="Low Consumption Warning Threshold"
                description="Alert when consumption is below average by this percentage"
              >
                <div class="flex items-center gap-4">
                  <UInput
                    v-model.number="formData.lowConsumptionThreshold"
                    type="number"
                    min="1"
                    max="200"
                    class="w-32"
                  />
                  <span class="text-muted">%</span>
                  <span class="text-sm text-muted">
                    (Low consumption may indicate recording errors)
                  </span>
                </div>
              </UFormField>

              <!-- Critical Threshold -->
              <UFormField
                label="Critical Alert Threshold"
                description="Deviation above this percentage is marked as critical"
              >
                <div class="flex items-center gap-4">
                  <UInput
                    v-model.number="formData.criticalThreshold"
                    type="number"
                    min="1"
                    max="300"
                    class="w-32"
                  />
                  <span class="text-muted">%</span>
                  <span class="text-sm text-muted">
                    (Should be higher than warning threshold)
                  </span>
                </div>
              </UFormField>

              <!-- Minimum Distance -->
              <UFormField
                label="Minimum Distance Between Refuels"
                description="Alert if refuel occurs with less than this distance traveled"
              >
                <div class="flex items-center gap-4">
                  <UInput
                    v-model.number="formData.minDistanceBetweenRefuels"
                    type="number"
                    min="0"
                    max="1000"
                    class="w-32"
                  />
                  <span class="text-muted">km</span>
                  <span class="text-sm text-muted">
                    (Detects potential fuel theft or errors)
                  </span>
                </div>
              </UFormField>
            </div>
          </UPageCard>

          <!-- Alert Types Section -->
          <UPageCard
            title="Alert Types"
            description="Enable or disable specific types of alerts"
            variant="naked"
            class="mb-4"
          />

          <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }" class="mb-6">
            <UFormField
              label="High Consumption Alerts"
              description="Alert when fuel consumption is above average"
              class="flex items-center justify-between not-last:pb-4 gap-2"
            >
              <USwitch v-model="formData.enableHighConsumptionAlerts" />
            </UFormField>

            <UFormField
              label="Low Consumption Alerts"
              description="Alert when fuel consumption is below average"
              class="flex items-center justify-between not-first:pt-4 not-last:pb-4 gap-2"
            >
              <USwitch v-model="formData.enableLowConsumptionAlerts" />
            </UFormField>

            <UFormField
              label="Refuel Without Distance Alerts"
              description="Alert when refueling with minimal distance traveled"
              class="flex items-center justify-between not-first:pt-4 not-last:pb-4 gap-2"
            >
              <USwitch v-model="formData.enableRefuelWithoutDistanceAlerts" />
            </UFormField>

            <UFormField
              label="Missing Odometer Alerts"
              description="Alert when fuel transactions lack odometer readings"
              class="flex items-center justify-between not-first:pt-4 gap-2"
            >
              <USwitch v-model="formData.enableMissingOdometerAlerts" />
            </UFormField>
          </UPageCard>

          <!-- Notification Settings Section -->
          <UPageCard
            title="Notification Settings"
            description="Choose how to receive anomaly alerts"
            variant="naked"
            class="mb-4"
          />

          <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }" class="mb-6">
            <UFormField
              label="In-App Notifications"
              description="Show alerts in the notification center"
              class="flex items-center justify-between not-last:pb-4 gap-2"
            >
              <USwitch v-model="formData.sendInAppNotifications" />
            </UFormField>

            <UFormField
              label="Email Notifications"
              description="Send email alerts to fleet managers"
              class="flex items-center justify-between not-first:pt-4 gap-2"
            >
              <USwitch v-model="formData.sendEmailNotifications" />
            </UFormField>
          </UPageCard>

          <!-- Notes Section -->
          <UPageCard
            title="Notes"
            description="Optional notes about your alert configuration"
            variant="naked"
            class="mb-4"
          />

          <UPageCard variant="subtle" class="mb-6">
            <UTextarea
              v-model="formData.notes"
              placeholder="Add any notes about your fuel alert configuration..."
              :rows="3"
            />
          </UPageCard>

          <!-- Test Section -->
          <UPageCard
            title="Test Anomaly Detection"
            description="Run a test to see what anomalies would be detected with current settings"
            variant="naked"
            class="mb-4"
          />

          <UPageCard variant="subtle" class="mb-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">
                  Test detection using the last 30 days of fuel data.
                  This will not create any notifications.
                </p>
              </div>
              <UButton
                label="Run Test"
                color="neutral"
                variant="outline"
                :loading="isTestingAnomalies"
                @click="testAnomalyDetection"
              />
            </div>

            <!-- Test Results -->
            <div v-if="testResults" class="mt-4 pt-4 border-t border-default-200">
              <h4 class="font-medium mb-3">Test Results</h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="text-center p-3 bg-default-100 rounded-lg">
                  <div class="text-2xl font-bold">{{ testResults.summary?.transactionsAnalyzed ?? 0 }}</div>
                  <div class="text-xs text-muted">Transactions</div>
                </div>
                <div class="text-center p-3 bg-default-100 rounded-lg">
                  <div class="text-2xl font-bold text-error">{{ testResults.summary?.criticalCount ?? 0 }}</div>
                  <div class="text-xs text-muted">Critical</div>
                </div>
                <div class="text-center p-3 bg-default-100 rounded-lg">
                  <div class="text-2xl font-bold text-warning">{{ testResults.summary?.warningCount ?? 0 }}</div>
                  <div class="text-xs text-muted">Warnings</div>
                </div>
                <div class="text-center p-3 bg-default-100 rounded-lg">
                  <div class="text-2xl font-bold text-info">{{ testResults.summary?.missingOdometerCount ?? 0 }}</div>
                  <div class="text-xs text-muted">Missing ODO</div>
                </div>
              </div>
              <div class="mt-3 text-sm text-muted">
                High consumption: {{ testResults.summary?.highConsumptionCount ?? 0 }} |
                Low consumption: {{ testResults.summary?.lowConsumptionCount ?? 0 }} |
                Refuel without distance: {{ testResults.summary?.refuelWithoutDistanceCount ?? 0 }}
              </div>
            </div>
          </UPageCard>

          <!-- Last Updated -->
          <div v-if="lastUpdated" class="text-sm text-muted text-center">
            Last updated: {{ lastUpdated }}
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
