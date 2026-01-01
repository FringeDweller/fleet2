/**
 * Bluetooth OBD Connection Composable
 * BLE connection for OBD-II adapters using Web Bluetooth API.
 * State: disconnected -> scanning -> connecting -> connected -> reconnecting
 *
 * Auto-reconnect: When enabled, automatically attempts to reconnect when
 * the connection drops unexpectedly. Configurable retry count and delay.
 */

const OBD_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
const WRITE_CHAR = '0000fff2-0000-1000-8000-00805f9b34fb'
const NOTIFY_CHAR = '0000fff1-0000-1000-8000-00805f9b34fb'

/** Default auto-reconnect configuration */
const DEFAULT_RECONNECT_OPTIONS: Required<AutoReconnectOptions> = {
  enabled: true,
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
}

export type BluetoothConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export interface OBDDevice {
  id: string
  name: string
}

export interface OBDCharacteristics {
  write: unknown
  notify: unknown
}

export interface AutoReconnectOptions {
  /** Enable auto-reconnect (default: true) */
  enabled?: boolean
  /** Maximum number of reconnection attempts (default: 3) */
  maxRetries?: number
  /** Initial delay between retries in milliseconds (default: 1000) */
  delayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
}

export interface ReconnectState {
  /** Whether auto-reconnect is currently enabled */
  enabled: boolean
  /** Current reconnection attempt number (0 if not reconnecting) */
  attempt: number
  /** Maximum retries configured */
  maxRetries: number
  /** Whether reconnection is in progress */
  isReconnecting: boolean
}

export interface UseBluetoothOBDOptions {
  autoReconnect?: AutoReconnectOptions
}

export function useBluetoothOBD(options: UseBluetoothOBDOptions = {}) {
  const connectionState = ref<BluetoothConnectionState>('disconnected')
  const connectedDevice = ref<OBDDevice | null>(null)
  const error = ref<string | null>(null)
  let gattServer: unknown = null
  let nativeDevice: unknown = null

  // Auto-reconnect state
  const reconnectOptions = ref<Required<AutoReconnectOptions>>({
    ...DEFAULT_RECONNECT_OPTIONS,
    ...options.autoReconnect,
  })
  const reconnectAttempt = ref(0)
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  let intentionalDisconnect = false
  let lastConnectedDevice: OBDDevice | null = null
  let lastCharacteristics: OBDCharacteristics | null = null

  /** Reactive reconnection state for UI consumption */
  const reconnectState = computed<ReconnectState>(() => ({
    enabled: reconnectOptions.value.enabled,
    attempt: reconnectAttempt.value,
    maxRetries: reconnectOptions.value.maxRetries,
    isReconnecting: connectionState.value === 'reconnecting',
  }))

  const isSupported = computed(() => {
    if (import.meta.server) return false
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  })

  /** Update auto-reconnect options at runtime */
  function setAutoReconnect(newOptions: AutoReconnectOptions): void {
    reconnectOptions.value = {
      ...reconnectOptions.value,
      ...newOptions,
    }
  }

  /** Cancel any pending reconnection attempts */
  function cancelReconnect(): void {
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId)
      reconnectTimeoutId = null
    }
    reconnectAttempt.value = 0
    if (connectionState.value === 'reconnecting') {
      connectionState.value = 'disconnected'
    }
  }

  /** Attempt to reconnect to the last connected device */
  async function attemptReconnect(): Promise<OBDCharacteristics | null> {
    if (!lastConnectedDevice || !nativeDevice) {
      cancelReconnect()
      return null
    }

    const { maxRetries, delayMs, backoffMultiplier } = reconnectOptions.value
    reconnectAttempt.value++

    if (reconnectAttempt.value > maxRetries) {
      // Max retries exceeded
      error.value = `Reconnection failed after ${maxRetries} attempts`
      connectionState.value = 'disconnected'
      reconnectAttempt.value = 0
      return null
    }

    connectionState.value = 'reconnecting'
    error.value = null

    try {
      const result = await connectInternal(lastConnectedDevice)
      if (result) {
        // Reconnection successful
        reconnectAttempt.value = 0
        lastCharacteristics = result
        return result
      }
    } catch {
      // Reconnection attempt failed
    }

    // Schedule next attempt with exponential backoff
    const delay = delayMs * backoffMultiplier ** (reconnectAttempt.value - 1)
    reconnectTimeoutId = setTimeout(() => {
      attemptReconnect()
    }, delay)

    return null
  }

  function handleDisconnect(): void {
    const wasConnected = connectionState.value === 'connected'
    connectionState.value = 'disconnected'
    connectedDevice.value = null
    gattServer = null

    // Trigger auto-reconnect if enabled and this was an unexpected disconnect
    if (
      wasConnected &&
      !intentionalDisconnect &&
      reconnectOptions.value.enabled &&
      lastConnectedDevice
    ) {
      attemptReconnect()
    } else if (!intentionalDisconnect) {
      // Reset nativeDevice only if not attempting reconnect
      nativeDevice = null
    }
  }

  async function scan(): Promise<OBDDevice | null> {
    if (!isSupported.value || !navigator.bluetooth) {
      error.value = 'Web Bluetooth is not supported'
      return null
    }
    try {
      error.value = null
      connectionState.value = 'scanning'
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [OBD_SERVICE] }],
        optionalServices: [OBD_SERVICE],
      })
      connectionState.value = 'disconnected'
      if (!device) return null
      nativeDevice = device
      return {
        id: (device as { id?: string }).id || crypto.randomUUID(),
        name: device.name || 'Unknown OBD Device',
      }
    } catch (err) {
      connectionState.value = 'disconnected'
      if (err instanceof Error && err.name === 'NotFoundError') return null
      error.value = err instanceof Error ? err.message : 'Scan failed'
      return null
    }
  }

  /** Internal connect logic shared between connect() and attemptReconnect() */
  async function connectInternal(device: OBDDevice): Promise<OBDCharacteristics | null> {
    const dev = nativeDevice as {
      gatt?: { connect(): Promise<unknown> }
      addEventListener?(type: string, fn: () => void): void
    }
    if (!dev?.gatt) {
      throw new Error('Device not found. Please scan again.')
    }

    gattServer = await dev.gatt.connect()
    dev.addEventListener?.('gattserverdisconnected', handleDisconnect)
    const server = gattServer as { getPrimaryService(s: string): Promise<unknown> }
    const svc = (await server.getPrimaryService(OBD_SERVICE)) as {
      getCharacteristic(c: string): Promise<unknown>
    }
    const write = await svc.getCharacteristic(WRITE_CHAR)
    const notify = (await svc.getCharacteristic(NOTIFY_CHAR)) as {
      startNotifications(): Promise<void>
    }
    await notify.startNotifications()
    connectionState.value = 'connected'
    connectedDevice.value = device
    return { write, notify }
  }

  async function connect(device: OBDDevice): Promise<OBDCharacteristics | null> {
    if (!isSupported.value) {
      error.value = 'Web Bluetooth is not supported'
      return null
    }
    const dev = nativeDevice as {
      gatt?: { connect(): Promise<unknown> }
      addEventListener?(type: string, fn: () => void): void
    }
    if (!dev?.gatt) {
      error.value = 'Device not found. Please scan again.'
      return null
    }
    try {
      error.value = null
      intentionalDisconnect = false
      connectionState.value = 'connecting'
      const result = await connectInternal(device)
      if (result) {
        lastConnectedDevice = device
        lastCharacteristics = result
      }
      return result
    } catch (err) {
      connectionState.value = 'disconnected'
      gattServer = null
      error.value = err instanceof Error ? err.message : 'Connection failed'
      return null
    }
  }

  async function disconnect(): Promise<void> {
    // Mark as intentional to prevent auto-reconnect
    intentionalDisconnect = true
    cancelReconnect()

    const dev = nativeDevice as { removeEventListener?(type: string, fn: () => void): void }
    dev?.removeEventListener?.('gattserverdisconnected', handleDisconnect)
    const srv = gattServer as { connected?: boolean; disconnect?(): void }
    if (srv?.connected) srv.disconnect?.()
    connectionState.value = 'disconnected'
    connectedDevice.value = null
    gattServer = nativeDevice = null
    lastConnectedDevice = null
    lastCharacteristics = null
    error.value = null
  }

  onUnmounted(() => {
    intentionalDisconnect = true
    cancelReconnect()
    disconnect()
  })

  return {
    // Connection state
    connectionState,
    connectedDevice,
    error,
    isSupported,
    // Connection methods
    scan,
    connect,
    disconnect,
    // Auto-reconnect state and methods
    reconnectState,
    setAutoReconnect,
    cancelReconnect,
  }
}
