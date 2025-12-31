<script setup lang="ts">
/**
 * OBD Pairing Dialog Component (US-10.1, US-10.2)
 *
 * Provides UI for scanning, pairing, and managing OBD device connections.
 * Shows available Bluetooth devices and allows selection for pairing.
 */

import type { ObdDeviceInfo } from '~/services/bluetoothObd'

const props = defineProps<{
  /** Asset ID to pair device with */
  assetId: string
  /** Asset name for display */
  assetName?: string
}>()

const emit = defineEmits<{
  /** Emitted when pairing is successful */
  paired: [device: ObdDeviceInfo]
  /** Emitted when device is disconnected */
  disconnected: []
}>()

// Dialog state
const isOpen = defineModel<boolean>('open', { default: false })

// Use OBD connection composable
const obd = useObdConnection({
  assetId: props.assetId,
  autoConnectOnMount: false, // Don't auto-connect when dialog opens
})

// Scanned device (before pairing confirmation)
const scannedDevice = ref<ObdDeviceInfo | null>(null)
const isPairing = ref(false)

// Get paired device info
const pairedDevice = computed(() => obd.getPairedDevice())

// Dialog steps
const currentStep = computed(() => {
  if (obd.isConnected.value) return 'connected'
  if (isPairing.value) return 'pairing'
  if (scannedDevice.value) return 'confirm'
  if (obd.isScanning.value) return 'scanning'
  return 'initial'
})

// Scan for devices
async function startScan() {
  scannedDevice.value = null
  const device = await obd.scan()
  if (device) {
    scannedDevice.value = device
  }
}

// Confirm pairing with scanned device
async function confirmPairing() {
  if (!scannedDevice.value) return

  isPairing.value = true

  try {
    const success = await obd.connect(scannedDevice.value)

    if (success) {
      // Save pairing to server and localStorage
      await obd.savePairing(scannedDevice.value)
      emit('paired', scannedDevice.value)
      scannedDevice.value = null
    }
  } finally {
    isPairing.value = false
  }
}

// Cancel pairing and clear scanned device
function cancelPairing() {
  scannedDevice.value = null
}

// Disconnect from current device
async function handleDisconnect() {
  await obd.disconnect()
  emit('disconnected')
}

// Remove pairing completely
async function handleRemovePairing() {
  await obd.removePairing()
  scannedDevice.value = null
  emit('disconnected')
}

// Try to reconnect to paired device
async function handleReconnect() {
  await obd.autoConnect()
}

// Reset state when dialog closes
watch(isOpen, (open) => {
  if (!open) {
    scannedDevice.value = null
    isPairing.value = false
  }
})
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">OBD Device Pairing</h3>
            <UButton
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              aria-label="Close dialog"
              @click="isOpen = false"
            />
          </div>
          <p v-if="assetName" class="text-sm text-muted-foreground mt-1">
            {{ assetName }}
          </p>
        </template>

        <!-- Browser support warning -->
        <template v-if="!obd.isSupported.value">
          <div class="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-4">
            <div class="flex gap-3">
              <UIcon
                name="i-lucide-alert-triangle"
                class="size-5 text-yellow-500 shrink-0 mt-0.5"
              />
              <div>
                <h4 class="font-medium text-yellow-800 dark:text-yellow-200">
                  Browser Not Supported
                </h4>
                <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Web Bluetooth is only available in Chromium-based browsers (Chrome, Edge, Opera)
                  on desktop or Android devices. Please use a supported browser to pair OBD devices.
                </p>
              </div>
            </div>
          </div>
        </template>

        <!-- Main content based on current step -->
        <template v-else>
          <!-- Connected state -->
          <template v-if="currentStep === 'connected'">
            <div class="space-y-4">
              <div class="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <div class="size-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <UIcon name="i-lucide-bluetooth-connected" class="size-5 text-green-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-green-800 dark:text-green-200 truncate">
                    {{ obd.connectedDevice.value?.name || 'Connected' }}
                  </p>
                  <p class="text-sm text-green-600 dark:text-green-400">
                    Connected and ready
                  </p>
                </div>
                <UBadge color="success" variant="subtle">
                  Active
                </UBadge>
              </div>

              <div class="flex gap-2">
                <UButton
                  variant="outline"
                  color="error"
                  class="flex-1"
                  @click="handleDisconnect"
                >
                  <UIcon name="i-lucide-unplug" class="size-4" />
                  Disconnect
                </UButton>
                <UButton
                  variant="ghost"
                  color="error"
                  @click="handleRemovePairing"
                >
                  <UIcon name="i-lucide-trash-2" class="size-4" />
                  Remove Pairing
                </UButton>
              </div>
            </div>
          </template>

          <!-- Confirm pairing step -->
          <template v-else-if="currentStep === 'confirm' || currentStep === 'pairing'">
            <div class="space-y-4">
              <div class="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div class="size-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <UIcon name="i-lucide-bluetooth-searching" class="size-5 text-blue-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-blue-800 dark:text-blue-200 truncate">
                    {{ scannedDevice?.name }}
                  </p>
                  <p class="text-sm text-blue-600 dark:text-blue-400">
                    Device found - ready to pair
                  </p>
                </div>
              </div>

              <p class="text-sm text-muted-foreground">
                Do you want to pair this OBD device with this asset?
                The device will automatically connect when you open this asset.
              </p>

              <div class="flex gap-2">
                <UButton
                  variant="outline"
                  class="flex-1"
                  :disabled="isPairing"
                  @click="cancelPairing"
                >
                  Cancel
                </UButton>
                <UButton
                  class="flex-1"
                  :loading="isPairing"
                  @click="confirmPairing"
                >
                  <UIcon name="i-lucide-link" class="size-4" />
                  Pair Device
                </UButton>
              </div>
            </div>
          </template>

          <!-- Scanning state -->
          <template v-else-if="currentStep === 'scanning'">
            <div class="py-8 text-center">
              <div class="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
                <UIcon
                  name="i-lucide-bluetooth-searching"
                  class="size-8 text-primary animate-pulse"
                />
              </div>
              <h4 class="font-medium">Scanning for devices...</h4>
              <p class="text-sm text-muted-foreground mt-1">
                Make sure your OBD dongle is powered on and in range
              </p>
            </div>
          </template>

          <!-- Initial state / Disconnected with error or paired device -->
          <template v-else>
            <div class="space-y-4">
              <!-- Show paired device info if exists but disconnected -->
              <template v-if="pairedDevice && !obd.isConnected.value">
                <div class="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div class="size-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <UIcon name="i-lucide-bluetooth-off" class="size-5 text-gray-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">
                      {{ pairedDevice.deviceName }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      Paired but disconnected
                    </p>
                  </div>
                  <UButton
                    size="sm"
                    :loading="obd.isConnecting.value"
                    @click="handleReconnect"
                  >
                    Reconnect
                  </UButton>
                </div>

                <UDivider label="or" />
              </template>

              <!-- Error message -->
              <template v-if="obd.lastError.value">
                <div class="rounded-lg bg-red-50 dark:bg-red-950 p-3">
                  <div class="flex gap-2">
                    <UIcon
                      name="i-lucide-alert-circle"
                      class="size-4 text-red-500 shrink-0 mt-0.5"
                    />
                    <p class="text-sm text-red-700 dark:text-red-300">
                      {{ obd.lastError.value }}
                    </p>
                  </div>
                </div>
              </template>

              <!-- Scan instructions -->
              <div class="text-center py-4">
                <div class="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
                  <UIcon name="i-lucide-bluetooth" class="size-8 text-primary" />
                </div>
                <h4 class="font-medium">Pair an OBD Device</h4>
                <p class="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Connect an ELM327 or compatible OBD-II Bluetooth dongle
                  to read vehicle data and diagnostics.
                </p>
              </div>

              <UButton
                block
                :loading="obd.isScanning.value"
                @click="startScan"
              >
                <UIcon name="i-lucide-search" class="size-4" />
                Scan for Devices
              </UButton>

              <!-- Help text -->
              <div class="text-xs text-muted-foreground space-y-1">
                <p class="flex items-center gap-1">
                  <UIcon name="i-lucide-info" class="size-3" />
                  Make sure Bluetooth is enabled on your device
                </p>
                <p class="flex items-center gap-1">
                  <UIcon name="i-lucide-info" class="size-3" />
                  OBD dongle should be plugged into the vehicle's OBD port
                </p>
              </div>
            </div>
          </template>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
