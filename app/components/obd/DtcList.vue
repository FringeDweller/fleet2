<script setup lang="ts">
/**
 * DTC List Component (US-10.3, US-10.4)
 *
 * Displays diagnostic trouble codes with severity indicators.
 * Provides Read Codes and Clear Codes buttons.
 */

import {
  createMockConnection,
  initializeElm327,
  isBluetoothAvailable,
  clearDtcs as obdClearDtcs,
  readDtcs as obdReadDtcs,
  type ParsedDtc,
} from '~/services/obdCommands'

interface Props {
  assetId: string
  assetNumber?: string
}

const props = defineProps<Props>()

const toast = useToast()
const isOnline = useOnline()

// Create a computed ref for the assetId
const assetIdRef = computed(() => props.assetId)

// Use the diagnostic codes composable
const {
  activeCodes,
  isLoading,
  isReading,
  isClearing,
  hasCriticalCodes,
  hasWarningCodes,
  fetchActiveCodes,
  readDtcs,
  clearDtcs,
} = useDiagnosticCodes(assetIdRef)

// State for the clear confirmation modal
const showClearConfirmModal = ref(false)
const selectedWorkOrderId = ref('')
const clearConfirmInput = ref('')

// Fetch work orders for dropdown
const { data: workOrdersData, status: workOrdersStatus } = await useFetch<{
  data: Array<{
    id: string
    workOrderNumber: string
    title: string
    status: string
  }>
}>('/api/work-orders', {
  query: { assetId: props.assetId, status: 'in_progress,open' },
  lazy: true,
})

// Initialize and fetch active codes
onMounted(() => {
  fetchActiveCodes()
})

// Watch for asset changes
watch(
  () => props.assetId,
  () => {
    fetchActiveCodes()
  },
)

/**
 * Handle Read Codes button click
 * Connects to OBD device and reads DTCs
 */
async function handleReadCodes() {
  try {
    // For now, use mock connection for testing
    // In production, this would use Bluetooth or Serial connection
    const connection = createMockConnection()

    // Initialize the ELM327
    const initResult = await initializeElm327(connection)
    if (!initResult.success) {
      toast.add({
        title: 'Connection Error',
        description: initResult.error || 'Failed to initialize OBD device',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return
    }

    // Read DTCs
    const dtcResult = await obdReadDtcs(connection)

    if (!dtcResult.success) {
      toast.add({
        title: 'Read Error',
        description: dtcResult.error || 'Failed to read DTCs',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return
    }

    if (dtcResult.codes.length === 0) {
      toast.add({
        title: 'No Codes Found',
        description: 'No diagnostic trouble codes detected',
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
      // Still record the read event (empty read)
      await readDtcs([], dtcResult.rawResponse)
      return
    }

    // Store the codes
    const result = await readDtcs(dtcResult.codes, dtcResult.rawResponse)

    if (result.success) {
      const hasCritical = dtcResult.codes.some((c) => c.severity === 'critical')
      toast.add({
        title: `${dtcResult.codes.length} Code(s) Found`,
        description: hasCritical
          ? 'Critical issues detected - immediate attention required'
          : 'Codes have been recorded',
        color: hasCritical ? 'error' : 'warning',
        icon: hasCritical ? 'i-lucide-alert-triangle' : 'i-lucide-info',
      })
    } else {
      toast.add({
        title: 'Error',
        description: result.error || 'Failed to save codes',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  } catch (error) {
    console.error('Read codes error:', error)
    toast.add({
      title: 'Error',
      description: 'An unexpected error occurred',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

/**
 * Open the clear confirmation modal
 */
function openClearModal() {
  if (activeCodes.value.length === 0) {
    toast.add({
      title: 'No Codes to Clear',
      description: 'There are no active diagnostic codes',
      color: 'neutral',
      icon: 'i-lucide-info',
    })
    return
  }

  showClearConfirmModal.value = true
  selectedWorkOrderId.value = ''
  clearConfirmInput.value = ''
}

/**
 * Handle Clear Codes confirmation
 */
async function handleClearCodes() {
  if (!selectedWorkOrderId.value) {
    toast.add({
      title: 'Work Order Required',
      description: 'Please select a work order to associate with the clear action',
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
    })
    return
  }

  if (clearConfirmInput.value !== 'CLEAR') {
    toast.add({
      title: 'Confirmation Required',
      description: 'Please type CLEAR to confirm',
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
    })
    return
  }

  try {
    // Send clear command to OBD device (mock for now)
    const connection = createMockConnection()
    await initializeElm327(connection)
    const obdResult = await obdClearDtcs(connection)

    if (!obdResult.success) {
      toast.add({
        title: 'Clear Failed',
        description: obdResult.error || 'OBD device rejected clear command',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return
    }

    // Record the clear action
    const result = await clearDtcs(selectedWorkOrderId.value)

    if (result.success) {
      toast.add({
        title: 'Codes Cleared',
        description: `${result.clearedCount} diagnostic code(s) cleared`,
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
      showClearConfirmModal.value = false
    } else {
      toast.add({
        title: 'Error',
        description: result.error || 'Failed to record clear action',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  } catch (error) {
    console.error('Clear codes error:', error)
    toast.add({
      title: 'Error',
      description: 'An unexpected error occurred',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

/**
 * Get severity badge color
 */
function getSeverityColor(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'critical':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'primary'
    default:
      return 'neutral'
  }
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'critical':
      return 'i-lucide-alert-octagon'
    case 'warning':
      return 'i-lucide-alert-triangle'
    case 'info':
      return 'i-lucide-info'
    default:
      return 'i-lucide-circle'
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header with actions -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">Diagnostic Trouble Codes</h3>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          :loading="isReading"
          :disabled="!isOnline"
          variant="outline"
          @click="handleReadCodes"
        >
          Read Codes
        </UButton>
        <UButton
          icon="i-lucide-trash-2"
          :loading="isClearing"
          :disabled="activeCodes.length === 0"
          color="error"
          variant="soft"
          @click="openClearModal"
        >
          Clear Codes
        </UButton>
      </div>
    </div>

    <!-- Offline indicator -->
    <UAlert
      v-if="!isOnline"
      color="warning"
      icon="i-lucide-wifi-off"
      title="Offline Mode"
      description="You are currently offline. Read operations will be queued for sync."
    />

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-neutral-500" />
    </div>

    <!-- Empty state -->
    <UCard v-else-if="activeCodes.length === 0" variant="soft">
      <div class="text-center py-8">
        <UIcon name="i-lucide-check-circle" class="h-12 w-12 mx-auto text-success-500 mb-4" />
        <h4 class="text-lg font-medium">No Active Codes</h4>
        <p class="text-neutral-500 mt-1">No diagnostic trouble codes are currently stored.</p>
      </div>
    </UCard>

    <!-- DTC list -->
    <div v-else class="space-y-3">
      <!-- Summary alert if critical codes -->
      <UAlert
        v-if="hasCriticalCodes"
        color="error"
        icon="i-lucide-alert-octagon"
        title="Critical Issues Detected"
        description="One or more critical diagnostic codes require immediate attention."
      />

      <!-- Code cards -->
      <UCard
        v-for="code in activeCodes"
        :key="code.id"
        :class="[
          'border-l-4',
          code.severity === 'critical' ? 'border-l-error-500' :
          code.severity === 'warning' ? 'border-l-warning-500' :
          'border-l-primary-500'
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <UIcon
              :name="getSeverityIcon(code.severity)"
              :class="[
                'h-6 w-6 mt-0.5',
                code.severity === 'critical' ? 'text-error-500' :
                code.severity === 'warning' ? 'text-warning-500' :
                'text-primary-500'
              ]"
            />
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-lg">{{ code.code }}</span>
                <UBadge :color="getSeverityColor(code.severity)" size="xs">
                  {{ code.severity }}
                </UBadge>
              </div>
              <p class="text-neutral-700 dark:text-neutral-300 mt-1">
                {{ code.description || 'Unknown code' }}
              </p>
              <p class="text-sm text-neutral-500 mt-2">
                Read: {{ formatDate(code.readAt) }}
                <span v-if="code.readByUser" class="ml-2">
                  by {{ code.readByUser.firstName }} {{ code.readByUser.lastName }}
                </span>
              </p>
              <UBadge
                v-if="code.syncStatus === 'pending'"
                color="warning"
                size="xs"
                class="mt-2"
              >
                Pending Sync
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Clear Confirmation Modal -->
    <UModal v-model:open="showClearConfirmModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-alert-triangle" class="h-5 w-5 text-warning-500" />
              <h3 class="font-semibold">Clear Diagnostic Codes</h3>
            </div>
          </template>

          <div class="space-y-4">
            <UAlert
              color="warning"
              icon="i-lucide-info"
              description="Clearing DTCs will reset the check engine light and erase freeze frame data. This action cannot be undone."
            />

            <div>
              <label class="block text-sm font-medium mb-2">
                Work Order Reference <span class="text-error-500">*</span>
              </label>
              <USelect
                v-model="selectedWorkOrderId"
                :items="workOrdersData?.data?.map((wo: { id: string; workOrderNumber: string; title: string; status: string }) => ({
                  label: `${wo.workOrderNumber} - ${wo.title}`,
                  value: wo.id
                })) || []"
                placeholder="Select work order..."
                :loading="workOrdersStatus === 'pending'"
              />
              <p class="text-sm text-neutral-500 mt-1">
                A work order reference is required to track clearing actions.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">
                Type CLEAR to confirm
              </label>
              <UInput
                v-model="clearConfirmInput"
                placeholder="Type CLEAR"
                class="font-mono"
              />
            </div>

            <div class="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
              <p class="text-sm font-medium mb-2">Codes to be cleared:</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="code in activeCodes"
                  :key="code.id"
                  :color="getSeverityColor(code.severity)"
                  size="sm"
                >
                  {{ code.code }}
                </UBadge>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                @click="showClearConfirmModal = false"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                :loading="isClearing"
                :disabled="!selectedWorkOrderId || clearConfirmInput !== 'CLEAR'"
                @click="handleClearCodes"
              >
                Clear All Codes
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
