/**
 * OBD Connection Composable (US-10.1, US-10.2)
 *
 * Provides reactive state management for Bluetooth OBD connections.
 * Handles auto-connection on mount, reconnection on connection loss,
 * and exposes scan/connect/disconnect methods.
 */

import {
  type BluetoothObdServiceState,
  getBluetoothObdService,
  type ObdDeviceInfo,
  type PairedDeviceData,
} from '~/services/bluetoothObd'

export interface UseObdConnectionOptions {
  // Asset ID to associate with the connection
  assetId?: string
  // Whether to auto-connect on mount if a paired device exists
  autoConnectOnMount?: boolean
  // Callback when connection state changes
  onConnectionChange?: (state: BluetoothObdServiceState) => void
  // Callback when device disconnects unexpectedly
  onDisconnect?: () => void
}

export interface UseObdConnectionReturn {
  // Reactive state
  connectionState: ComputedRef<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>
  connectedDevice: ComputedRef<ObdDeviceInfo | null>
  lastError: ComputedRef<string | null>
  isScanning: ComputedRef<boolean>
  isSupported: ComputedRef<boolean>

  // Derived state
  isConnected: ComputedRef<boolean>
  isConnecting: ComputedRef<boolean>
  statusText: ComputedRef<string>
  statusColor: ComputedRef<'success' | 'warning' | 'error' | 'neutral'>

  // Actions
  scan: () => Promise<ObdDeviceInfo | null>
  connect: (device: ObdDeviceInfo) => Promise<boolean>
  disconnect: () => Promise<void>
  getPairedDevice: () => PairedDeviceData | null
  savePairing: (device: ObdDeviceInfo) => Promise<void>
  removePairing: () => Promise<void>
  autoConnect: () => Promise<boolean>
}

export function useObdConnection(options: UseObdConnectionOptions = {}): UseObdConnectionReturn {
  const { assetId, autoConnectOnMount = true, onConnectionChange, onDisconnect } = options

  const toast = useToast()
  const service = getBluetoothObdService()

  // Reactive state synced with service
  const serviceState = ref<BluetoothObdServiceState>({
    connectionState: 'disconnected',
    connectedDevice: null,
    lastError: null,
    isScanning: false,
  })

  // Check browser support
  const isSupported = computed(() => {
    if (import.meta.server) return false
    return service.isSupported()
  })

  // Subscribe to service state changes
  let unsubscribeStateChange: (() => void) | null = null
  let unsubscribeDisconnect: (() => void) | null = null

  if (import.meta.client) {
    unsubscribeStateChange = service.onStateChange((state) => {
      serviceState.value = state
      onConnectionChange?.(state)
    })

    unsubscribeDisconnect = service.onDisconnect(() => {
      onDisconnect?.()
    })
  }

  // Computed state accessors
  const connectionState = computed(() => serviceState.value.connectionState)
  const connectedDevice = computed(() => serviceState.value.connectedDevice)
  const lastError = computed(() => serviceState.value.lastError)
  const isScanning = computed(() => serviceState.value.isScanning)

  // Derived state
  const isConnected = computed(() => serviceState.value.connectionState === 'connected')
  const isConnecting = computed(
    () =>
      serviceState.value.connectionState === 'connecting' ||
      serviceState.value.connectionState === 'reconnecting',
  )

  const statusText = computed(() => {
    switch (serviceState.value.connectionState) {
      case 'connected':
        return serviceState.value.connectedDevice?.name || 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'reconnecting':
        return 'Reconnecting...'
      default:
        return 'Disconnected'
    }
  })

  const statusColor = computed<'success' | 'warning' | 'error' | 'neutral'>(() => {
    switch (serviceState.value.connectionState) {
      case 'connected':
        return 'success'
      case 'connecting':
      case 'reconnecting':
        return 'warning'
      default:
        if (serviceState.value.lastError) return 'error'
        return 'neutral'
    }
  })

  /**
   * Scan for available OBD devices
   */
  async function scan(): Promise<ObdDeviceInfo | null> {
    if (!isSupported.value) {
      toast.add({
        title: 'Bluetooth Not Supported',
        description:
          'Web Bluetooth is not available in this browser. Use Chrome on desktop or Android.',
        color: 'error',
      })
      return null
    }

    const device = await service.scan()

    if (device) {
      toast.add({
        title: 'Device Found',
        description: `Found: ${device.name}`,
        color: 'success',
      })
    }

    return device
  }

  /**
   * Connect to a specific device
   */
  async function connect(device: ObdDeviceInfo): Promise<boolean> {
    if (!isSupported.value) {
      toast.add({
        title: 'Bluetooth Not Supported',
        description: 'Web Bluetooth is not available in this browser.',
        color: 'error',
      })
      return false
    }

    const success = await service.connect(device)

    if (success) {
      toast.add({
        title: 'Connected',
        description: `Connected to ${device.name}`,
        color: 'success',
      })
    } else if (serviceState.value.lastError) {
      toast.add({
        title: 'Connection Failed',
        description: serviceState.value.lastError,
        color: 'error',
      })
    }

    return success
  }

  /**
   * Disconnect from the current device
   */
  async function disconnect(): Promise<void> {
    const deviceName = serviceState.value.connectedDevice?.name
    await service.disconnect()

    if (deviceName) {
      toast.add({
        title: 'Disconnected',
        description: `Disconnected from ${deviceName}`,
        color: 'neutral',
      })
    }
  }

  /**
   * Get the paired device for the current asset
   */
  function getPairedDevice(): PairedDeviceData | null {
    if (!assetId) return null
    return service.getPairedDevice(assetId)
  }

  /**
   * Save pairing information for the current asset
   */
  async function savePairing(device: ObdDeviceInfo): Promise<void> {
    if (!assetId) {
      console.warn('[useObdConnection] Cannot save pairing: no assetId provided')
      return
    }

    // Save to localStorage for auto-reconnect
    service.savePairedDevice(assetId, device)

    // Also save to server for persistence across devices
    try {
      await $fetch('/api/obd/devices', {
        method: 'POST',
        body: {
          assetId,
          bluetoothDeviceId: device.id,
          deviceName: device.name,
          serviceUuid: device.serviceUuid,
        },
      })

      toast.add({
        title: 'Device Paired',
        description: `${device.name} has been paired with this asset`,
        color: 'success',
      })
    } catch (error) {
      console.error('[useObdConnection] Failed to save pairing to server:', error)
      // Don't show error toast - local pairing still works
    }
  }

  /**
   * Remove pairing for the current asset
   */
  async function removePairing(): Promise<void> {
    if (!assetId) {
      console.warn('[useObdConnection] Cannot remove pairing: no assetId provided')
      return
    }

    // Disconnect if connected
    if (isConnected.value) {
      await disconnect()
    }

    // Remove from localStorage
    service.removePairedDevice(assetId)

    // Remove from server
    try {
      // First get the device ID from the server
      const serverDevice = await $fetch<{ id: string } | null>(`/api/obd/devices/${assetId}`)
      if (serverDevice?.id) {
        await $fetch(`/api/obd/devices/${serverDevice.id}`, {
          method: 'DELETE',
        })
      }
    } catch {
      // Ignore 404 errors - device may not exist on server
      console.log('[useObdConnection] No server pairing to remove')
    }

    toast.add({
      title: 'Pairing Removed',
      description: 'OBD device pairing has been removed',
      color: 'neutral',
    })
  }

  /**
   * Auto-connect to a previously paired device
   */
  async function autoConnect(): Promise<boolean> {
    if (!assetId) {
      console.warn('[useObdConnection] Cannot auto-connect: no assetId provided')
      return false
    }

    if (!isSupported.value) {
      return false
    }

    // Check if already connected
    if (isConnected.value) {
      return true
    }

    return service.autoConnect(assetId)
  }

  // Auto-connect on mount if enabled
  if (import.meta.client && autoConnectOnMount && assetId) {
    onMounted(async () => {
      // Small delay to ensure component is fully mounted
      await nextTick()

      const pairedDevice = getPairedDevice()
      if (pairedDevice) {
        console.log('[useObdConnection] Auto-connecting to paired device:', pairedDevice.deviceName)
        autoConnect()
      }
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribeStateChange?.()
    unsubscribeDisconnect?.()
  })

  return {
    // Reactive state
    connectionState,
    connectedDevice,
    lastError,
    isScanning,
    isSupported,

    // Derived state
    isConnected,
    isConnecting,
    statusText,
    statusColor,

    // Actions
    scan,
    connect,
    disconnect,
    getPairedDevice,
    savePairing,
    removePairing,
    autoConnect,
  }
}
