<script setup lang="ts">
/**
 * OBD Device Pairing Component
 *
 * Provides UI for scanning and connecting to Bluetooth OBD-II adapters.
 * Uses the useBluetoothOBD composable for device discovery and connection.
 *
 * Features:
 * - Scan button to trigger device discovery via Web Bluetooth
 * - Display discovered device with name
 * - Connect button for the device
 * - Connection state display (disconnected, scanning, connecting, connected)
 * - Error display for connection failures
 */

import type { OBDCharacteristics, OBDDevice } from '~/composables/useBluetoothOBD'

const props = defineProps<{
  /** Optional title for the pairing section */
  title?: string
  /** Whether to show the header */
  showHeader?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when device is connected with its characteristics */
  connected: [device: OBDDevice, characteristics: OBDCharacteristics]
  /** Emitted when device is disconnected */
  disconnected: []
  /** Emitted when an error occurs */
  error: [message: string]
}>()

// Use Bluetooth OBD composable
const {
  connectionState,
  connectedDevice,
  error: connectionError,
  isSupported,
  scan,
  connect,
  disconnect,
} = useBluetoothOBD()

// Track discovered device from scan (before connection)
const discoveredDevice = ref<OBDDevice | null>(null)

// Computed state helpers
const isDisconnected = computed(() => connectionState.value === 'disconnected')
const isScanning = computed(() => connectionState.value === 'scanning')
const isConnecting = computed(() => connectionState.value === 'connecting')
const isConnected = computed(() => connectionState.value === 'connected')

// Connection state badge properties
const stateBadge = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return { color: 'success' as const, label: 'Connected', icon: 'i-lucide-bluetooth-connected' }
    case 'connecting':
      return { color: 'warning' as const, label: 'Connecting...', icon: 'i-lucide-loader-2' }
    case 'scanning':
      return { color: 'info' as const, label: 'Scanning...', icon: 'i-lucide-bluetooth-searching' }
    default:
      return { color: 'neutral' as const, label: 'Disconnected', icon: 'i-lucide-bluetooth-off' }
  }
})

// Handle scan button click
async function handleScan() {
  discoveredDevice.value = null
  const device = await scan()
  if (device) {
    discoveredDevice.value = device
  }
}

// Handle connect button click
async function handleConnect() {
  if (!discoveredDevice.value) return

  const characteristics = await connect(discoveredDevice.value)
  if (characteristics) {
    emit('connected', discoveredDevice.value, characteristics)
  } else if (connectionError.value) {
    emit('error', connectionError.value)
  }
}

// Handle disconnect button click
async function handleDisconnect() {
  await disconnect()
  discoveredDevice.value = null
  emit('disconnected')
}

// Clear discovered device when there's a connection error
watch(connectionError, (error) => {
  if (error) {
    emit('error', error)
  }
})
</script>

<template>
  <UCard>
    <!-- Header -->
    <template v-if="showHeader !== false" #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ title || 'OBD Device Pairing' }}
        </h3>
        <UBadge :color="stateBadge.color" variant="subtle" class="gap-1.5">
          <UIcon
            :name="stateBadge.icon"
            :class="['size-3.5', { 'animate-spin': isConnecting, 'animate-pulse': isScanning }]"
            aria-hidden="true"
          />
          {{ stateBadge.label }}
        </UBadge>
      </div>
    </template>

    <!-- Browser support warning -->
    <template v-if="!isSupported">
      <div class="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-4" role="alert">
        <div class="flex gap-3">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-5 text-yellow-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h4 class="font-medium text-yellow-800 dark:text-yellow-200">
              Browser Not Supported
            </h4>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Web Bluetooth is only available in Chromium-based browsers (Chrome, Edge, Opera)
              on desktop or Android devices.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Main content when supported -->
    <template v-else>
      <div class="space-y-4">
        <!-- Error display -->
        <div
          v-if="connectionError"
          class="rounded-lg bg-red-50 dark:bg-red-950 p-3"
          role="alert"
        >
          <div class="flex gap-2">
            <UIcon
              name="i-lucide-alert-circle"
              class="size-4 text-red-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ connectionError }}
            </p>
          </div>
        </div>

        <!-- Connected device display -->
        <div
          v-if="isConnected && connectedDevice"
          class="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950"
        >
          <div class="size-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <UIcon name="i-lucide-bluetooth-connected" class="size-5 text-green-600" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-green-800 dark:text-green-200 truncate">
              {{ connectedDevice.name }}
            </p>
            <p class="text-sm text-green-600 dark:text-green-400">
              Connected and ready
            </p>
          </div>
          <UButton
            variant="outline"
            color="error"
            size="sm"
            @click="handleDisconnect"
          >
            <UIcon name="i-lucide-unplug" class="size-4" aria-hidden="true" />
            Disconnect
          </UButton>
        </div>

        <!-- Discovered device (not yet connected) -->
        <div
          v-else-if="discoveredDevice && isDisconnected"
          class="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950"
        >
          <div class="size-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <UIcon name="i-lucide-bluetooth" class="size-5 text-blue-600" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-blue-800 dark:text-blue-200 truncate">
              {{ discoveredDevice.name }}
            </p>
            <p class="text-sm text-blue-600 dark:text-blue-400">
              Device found - ready to connect
            </p>
          </div>
          <UButton
            size="sm"
            @click="handleConnect"
          >
            <UIcon name="i-lucide-link" class="size-4" aria-hidden="true" />
            Connect
          </UButton>
        </div>

        <!-- Connecting state -->
        <div
          v-else-if="isConnecting && discoveredDevice"
          class="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950"
        >
          <div class="size-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
            <UIcon name="i-lucide-loader-2" class="size-5 text-amber-600 animate-spin" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-amber-800 dark:text-amber-200 truncate">
              {{ discoveredDevice.name }}
            </p>
            <p class="text-sm text-amber-600 dark:text-amber-400">
              Connecting to device...
            </p>
          </div>
        </div>

        <!-- Scanning state -->
        <div
          v-else-if="isScanning"
          class="py-8 text-center"
        >
          <div class="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
            <UIcon
              name="i-lucide-bluetooth-searching"
              class="size-8 text-primary animate-pulse"
              aria-hidden="true"
            />
          </div>
          <h4 class="font-medium">Scanning for devices...</h4>
          <p class="text-sm text-muted-foreground mt-1">
            Select your OBD device from the browser dialog
          </p>
        </div>

        <!-- Initial state - ready to scan -->
        <div
          v-else
          class="space-y-4"
        >
          <div class="text-center py-4">
            <div class="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
              <UIcon name="i-lucide-bluetooth" class="size-8 text-primary" aria-hidden="true" />
            </div>
            <h4 class="font-medium">Pair an OBD Device</h4>
            <p class="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Connect an ELM327 or compatible OBD-II Bluetooth adapter to read vehicle data and diagnostics.
            </p>
          </div>

          <UButton
            block
            :loading="isScanning"
            @click="handleScan"
          >
            <UIcon name="i-lucide-search" class="size-4" aria-hidden="true" />
            Scan for Devices
          </UButton>

          <!-- Help text -->
          <div class="text-xs text-muted-foreground space-y-1">
            <p class="flex items-center gap-1">
              <UIcon name="i-lucide-info" class="size-3" aria-hidden="true" />
              Make sure Bluetooth is enabled on your device
            </p>
            <p class="flex items-center gap-1">
              <UIcon name="i-lucide-info" class="size-3" aria-hidden="true" />
              OBD adapter should be plugged into the vehicle's OBD port
            </p>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>
