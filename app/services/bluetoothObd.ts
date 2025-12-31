/**
 * Bluetooth OBD Service (US-10.1, US-10.2)
 *
 * Handles Web Bluetooth connections to ELM327 and compatible OBD-II dongles.
 * Provides scan, connect, disconnect, and reconnection functionality.
 *
 * Note: Web Bluetooth API is only available in Chromium-based browsers and
 * requires a secure context (HTTPS or localhost).
 */

// ELM327 typically uses Serial Port Profile (SPP) UUID
const SPP_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb'

// Common OBD device name patterns for filtering during scan
const OBD_DEVICE_NAME_PATTERNS = [
  'obd',
  'elm',
  'vlink',
  'vgate',
  'obdlink',
  'carista',
  'torque',
  'easyobd',
  'veepeak',
  'bafx',
  'bluedriver',
  'konnwei',
  'ancel',
  'foxwell',
  'launch',
  'autel',
]

// Storage key for persisting paired device information
const PAIRED_DEVICE_STORAGE_KEY = 'fleet-obd-paired-device'

export type ObdConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface ObdDeviceInfo {
  id: string
  name: string
  serviceUuid?: string
}

export interface PairedDeviceData {
  assetId: string
  deviceId: string
  deviceName: string
  serviceUuid?: string
  pairedAt: string
}

export interface BluetoothObdServiceState {
  connectionState: ObdConnectionState
  connectedDevice: ObdDeviceInfo | null
  lastError: string | null
  isScanning: boolean
}

export interface BluetoothObdService {
  // State
  state: BluetoothObdServiceState

  // Methods
  isSupported: () => boolean
  scan: () => Promise<ObdDeviceInfo | null>
  connect: (device: ObdDeviceInfo) => Promise<boolean>
  disconnect: () => Promise<void>
  getPairedDevice: (assetId: string) => PairedDeviceData | null
  savePairedDevice: (assetId: string, device: ObdDeviceInfo) => void
  removePairedDevice: (assetId: string) => void
  autoConnect: (assetId: string) => Promise<boolean>

  // Event handlers
  onStateChange: (callback: (state: BluetoothObdServiceState) => void) => () => void
  onDisconnect: (callback: () => void) => () => void
}

// Web Bluetooth type declarations
interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>
  readValue(): Promise<DataView>
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
}

interface Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ namePrefix?: string; name?: string; services?: string[] }>
      acceptAllDevices?: boolean
      optionalServices?: string[]
    }): Promise<BluetoothDevice>
    getDevices?(): Promise<BluetoothDevice[]>
  }
}

declare const navigator: Navigator

/**
 * Creates a Bluetooth OBD service instance
 */
export function createBluetoothObdService(): BluetoothObdService {
  let currentDevice: BluetoothDevice | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  let reconnectTimeout: NodeJS.Timeout | null = null
  let isAutoReconnecting = false
  let currentAssetId: string | null = null

  // State management
  const state: BluetoothObdServiceState = {
    connectionState: 'disconnected',
    connectedDevice: null,
    lastError: null,
    isScanning: false,
  }

  // Event listeners
  const stateChangeListeners: Set<(state: BluetoothObdServiceState) => void> = new Set()
  const disconnectListeners: Set<() => void> = new Set()

  function notifyStateChange(): void {
    for (const listener of stateChangeListeners) {
      listener({ ...state })
    }
  }

  function updateState(updates: Partial<BluetoothObdServiceState>): void {
    Object.assign(state, updates)
    notifyStateChange()
  }

  /**
   * Check if Web Bluetooth API is available
   */
  function isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'bluetooth' in navigator && navigator.bluetooth !== undefined
  }

  /**
   * Calculate exponential backoff delay for reconnection
   */
  function getReconnectDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    const baseDelay = 1000
    const maxDelay = 16000
    const delay = Math.min(baseDelay * 2 ** attempt, maxDelay)
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }

  /**
   * Handle device disconnection
   */
  function handleDisconnect(): void {
    console.log('[BluetoothOBD] Device disconnected')

    // Notify disconnect listeners
    for (const listener of disconnectListeners) {
      listener()
    }

    // If we have a paired device and auto-reconnect is enabled, try to reconnect
    if (currentAssetId && !isAutoReconnecting) {
      const pairedDevice = getPairedDevice(currentAssetId)
      if (pairedDevice) {
        attemptReconnect(pairedDevice)
      } else {
        updateState({
          connectionState: 'disconnected',
          connectedDevice: null,
        })
      }
    } else {
      updateState({
        connectionState: 'disconnected',
        connectedDevice: null,
      })
    }
  }

  /**
   * Attempt to reconnect to a previously paired device
   */
  async function attemptReconnect(pairedDevice: PairedDeviceData): Promise<void> {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('[BluetoothOBD] Max reconnect attempts reached')
      updateState({
        connectionState: 'disconnected',
        lastError: 'Failed to reconnect after multiple attempts',
      })
      reconnectAttempts = 0
      isAutoReconnecting = false
      return
    }

    isAutoReconnecting = true
    reconnectAttempts++
    const delay = getReconnectDelay(reconnectAttempts - 1)

    console.log(
      `[BluetoothOBD] Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`,
    )
    updateState({ connectionState: 'reconnecting' })

    reconnectTimeout = setTimeout(async () => {
      try {
        const success = await connectToDevice({
          id: pairedDevice.deviceId,
          name: pairedDevice.deviceName,
          serviceUuid: pairedDevice.serviceUuid,
        })

        if (success) {
          console.log('[BluetoothOBD] Reconnection successful')
          reconnectAttempts = 0
          isAutoReconnecting = false
        } else {
          // Try again
          attemptReconnect(pairedDevice)
        }
      } catch (error) {
        console.error('[BluetoothOBD] Reconnect error:', error)
        attemptReconnect(pairedDevice)
      }
    }, delay)
  }

  /**
   * Connect to a specific Bluetooth device
   */
  async function connectToDevice(device: ObdDeviceInfo): Promise<boolean> {
    if (!isSupported() || !navigator.bluetooth) {
      updateState({ lastError: 'Web Bluetooth is not supported' })
      return false
    }

    try {
      updateState({ connectionState: 'connecting', lastError: null })

      // Try to get previously paired devices from the browser
      const pairedDevices = await navigator.bluetooth.getDevices?.()
      let targetDevice: BluetoothDevice | undefined

      if (pairedDevices) {
        targetDevice = pairedDevices.find((d) => d.id === device.id)
      }

      // If not found in paired devices, request new pairing
      if (!targetDevice) {
        // We need to request the device again with user interaction
        // This will show the browser's device picker
        console.log('[BluetoothOBD] Device not in paired list, requires user interaction')
        updateState({
          connectionState: 'disconnected',
          lastError: 'Device not found. Please scan and pair again.',
        })
        return false
      }

      // Connect to GATT server
      if (!targetDevice.gatt) {
        updateState({
          connectionState: 'disconnected',
          lastError: 'Device does not support GATT',
        })
        return false
      }

      await targetDevice.gatt.connect()

      // Set up disconnect listener
      targetDevice.addEventListener('gattserverdisconnected', handleDisconnect)

      currentDevice = targetDevice
      updateState({
        connectionState: 'connected',
        connectedDevice: {
          id: targetDevice.id,
          name: targetDevice.name || 'Unknown Device',
          serviceUuid: device.serviceUuid,
        },
        lastError: null,
      })

      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to device'
      console.error('[BluetoothOBD] Connection error:', error)
      updateState({
        connectionState: 'disconnected',
        lastError: errorMessage,
      })
      return false
    }
  }

  /**
   * Scan for available OBD devices
   */
  async function scan(): Promise<ObdDeviceInfo | null> {
    if (!isSupported() || !navigator.bluetooth) {
      updateState({ lastError: 'Web Bluetooth is not supported on this browser' })
      return null
    }

    try {
      updateState({ isScanning: true, lastError: null })

      // Build filters for common OBD device names
      const filters = OBD_DEVICE_NAME_PATTERNS.map((prefix) => ({
        namePrefix: prefix,
      }))

      // Request device with filters and optional SPP service
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: [SPP_SERVICE_UUID],
      })

      updateState({ isScanning: false })

      if (device) {
        return {
          id: device.id,
          name: device.name || 'Unknown OBD Device',
          serviceUuid: SPP_SERVICE_UUID,
        }
      }

      return null
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan for devices'

      // User cancelled is not an error
      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        updateState({ isScanning: false, lastError: null })
        return null
      }

      console.error('[BluetoothOBD] Scan error:', error)
      updateState({ isScanning: false, lastError: errorMessage })
      return null
    }
  }

  /**
   * Connect to a scanned device
   */
  async function connect(device: ObdDeviceInfo): Promise<boolean> {
    if (!isSupported() || !navigator.bluetooth) {
      updateState({ lastError: 'Web Bluetooth is not supported' })
      return false
    }

    try {
      updateState({ connectionState: 'connecting', lastError: null })

      // Request the device again to establish connection
      // This uses the same ID so it should reconnect to the same device
      const filters = device.name
        ? [{ name: device.name }]
        : OBD_DEVICE_NAME_PATTERNS.map((prefix) => ({ namePrefix: prefix }))

      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: [SPP_SERVICE_UUID],
      })

      if (!bluetoothDevice) {
        updateState({
          connectionState: 'disconnected',
          lastError: 'No device selected',
        })
        return false
      }

      if (!bluetoothDevice.gatt) {
        updateState({
          connectionState: 'disconnected',
          lastError: 'Device does not support GATT',
        })
        return false
      }

      // Connect to GATT server
      await bluetoothDevice.gatt.connect()

      // Set up disconnect listener
      bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnect)

      currentDevice = bluetoothDevice
      updateState({
        connectionState: 'connected',
        connectedDevice: {
          id: bluetoothDevice.id,
          name: bluetoothDevice.name || device.name,
          serviceUuid: device.serviceUuid,
        },
        lastError: null,
      })

      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to device'

      // User cancelled is not an error
      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        updateState({ connectionState: 'disconnected', lastError: null })
        return false
      }

      console.error('[BluetoothOBD] Connection error:', error)
      updateState({
        connectionState: 'disconnected',
        lastError: errorMessage,
      })
      return false
    }
  }

  /**
   * Disconnect from the current device
   */
  async function disconnect(): Promise<void> {
    // Cancel any pending reconnection
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    isAutoReconnecting = false
    reconnectAttempts = 0

    if (currentDevice?.gatt?.connected) {
      currentDevice.removeEventListener('gattserverdisconnected', handleDisconnect)
      currentDevice.gatt.disconnect()
    }

    currentDevice = null
    currentAssetId = null
    updateState({
      connectionState: 'disconnected',
      connectedDevice: null,
      lastError: null,
    })
  }

  /**
   * Get paired device data from localStorage
   */
  function getPairedDevice(assetId: string): PairedDeviceData | null {
    if (typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(`${PAIRED_DEVICE_STORAGE_KEY}-${assetId}`)
      if (!stored) return null
      return JSON.parse(stored) as PairedDeviceData
    } catch {
      return null
    }
  }

  /**
   * Save paired device data to localStorage
   */
  function savePairedDevice(assetId: string, device: ObdDeviceInfo): void {
    if (typeof window === 'undefined') return

    const data: PairedDeviceData = {
      assetId,
      deviceId: device.id,
      deviceName: device.name,
      serviceUuid: device.serviceUuid,
      pairedAt: new Date().toISOString(),
    }

    localStorage.setItem(`${PAIRED_DEVICE_STORAGE_KEY}-${assetId}`, JSON.stringify(data))
  }

  /**
   * Remove paired device data from localStorage
   */
  function removePairedDevice(assetId: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(`${PAIRED_DEVICE_STORAGE_KEY}-${assetId}`)
  }

  /**
   * Auto-connect to a previously paired device
   */
  async function autoConnect(assetId: string): Promise<boolean> {
    currentAssetId = assetId
    const pairedDevice = getPairedDevice(assetId)

    if (!pairedDevice) {
      console.log('[BluetoothOBD] No paired device found for asset:', assetId)
      return false
    }

    console.log('[BluetoothOBD] Attempting auto-connect to:', pairedDevice.deviceName)

    const success = await connectToDevice({
      id: pairedDevice.deviceId,
      name: pairedDevice.deviceName,
      serviceUuid: pairedDevice.serviceUuid,
    })

    return success
  }

  /**
   * Subscribe to state changes
   */
  function onStateChange(callback: (state: BluetoothObdServiceState) => void): () => void {
    stateChangeListeners.add(callback)
    // Immediately call with current state
    callback({ ...state })
    return () => {
      stateChangeListeners.delete(callback)
    }
  }

  /**
   * Subscribe to disconnect events
   */
  function onDisconnect(callback: () => void): () => void {
    disconnectListeners.add(callback)
    return () => {
      disconnectListeners.delete(callback)
    }
  }

  return {
    state,
    isSupported,
    scan,
    connect,
    disconnect,
    getPairedDevice,
    savePairedDevice,
    removePairedDevice,
    autoConnect,
    onStateChange,
    onDisconnect,
  }
}

// Singleton instance for the service
let serviceInstance: BluetoothObdService | null = null

/**
 * Get the singleton Bluetooth OBD service instance
 */
export function getBluetoothObdService(): BluetoothObdService {
  if (!serviceInstance) {
    serviceInstance = createBluetoothObdService()
  }
  return serviceInstance
}
