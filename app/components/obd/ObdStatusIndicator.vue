<script setup lang="ts">
/**
 * OBD Status Indicator Component (US-10.1, US-10.2)
 *
 * Displays the current OBD connection status with visual indicators.
 * Shows device name when connected and provides quick access to
 * pairing dialog or disconnect action.
 */

const props = defineProps<{
  /** Asset ID to track connection for */
  assetId: string
  /** Whether to show the device name when connected */
  showDeviceName?: boolean
  /** Size of the indicator */
  size?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{
  /** Emitted when the user clicks to open pairing dialog */
  openPairing: []
  /** Emitted when connection state changes */
  connectionChange: [connected: boolean]
}>()

// Use OBD connection composable
const obd = useObdConnection({
  assetId: props.assetId,
  autoConnectOnMount: true,
  onConnectionChange: (state) => {
    emit('connectionChange', state.connectionState === 'connected')
  },
})

// Size classes
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-6 px-2 text-xs'
    case 'lg':
      return 'h-10 px-4 text-base'
    default:
      return 'h-8 px-3 text-sm'
  }
})

// Status dot size
const dotSizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'size-1.5'
    case 'lg':
      return 'size-3'
    default:
      return 'size-2'
  }
})

// Status dot color
const dotColorClass = computed(() => {
  switch (obd.connectionState.value) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
    case 'reconnecting':
      return 'bg-yellow-500 animate-pulse'
    default:
      return obd.lastError.value ? 'bg-red-500' : 'bg-gray-400'
  }
})

// Handle click action
function handleClick() {
  if (obd.isConnected.value) {
    // Show disconnect confirmation or menu
    emit('openPairing')
  } else {
    // Open pairing dialog
    emit('openPairing')
  }
}

// Expose OBD connection methods for parent components
defineExpose({
  obd,
})
</script>

<template>
  <UButton
    variant="ghost"
    :class="[sizeClasses, 'gap-2']"
    :aria-label="`OBD Status: ${obd.statusText.value}`"
    @click="handleClick"
  >
    <!-- Status dot with animation for connecting states -->
    <span
      :class="[dotSizeClass, dotColorClass, 'rounded-full shrink-0']"
      aria-hidden="true"
    />

    <!-- Status text -->
    <span class="truncate max-w-32">
      <template v-if="showDeviceName && obd.connectedDevice.value?.name">
        {{ obd.connectedDevice.value.name }}
      </template>
      <template v-else>
        {{ obd.statusText.value }}
      </template>
    </span>

    <!-- Loading spinner for connecting states -->
    <UIcon
      v-if="obd.isConnecting.value"
      name="i-lucide-loader-2"
      class="size-4 animate-spin text-muted-foreground"
      aria-hidden="true"
    />

    <!-- Bluetooth icon for disconnected state -->
    <UIcon
      v-else-if="!obd.isConnected.value && !obd.isConnecting.value"
      name="i-lucide-bluetooth-off"
      class="size-4 text-muted-foreground"
      aria-hidden="true"
    />

    <!-- Connected icon -->
    <UIcon
      v-else
      name="i-lucide-bluetooth-connected"
      class="size-4 text-green-500"
      aria-hidden="true"
    />
  </UButton>
</template>
