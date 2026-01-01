/**
 * OBD-II Live Data Composable
 *
 * Provides real-time vehicle data polling from OBD-II adapters.
 * Polls for RPM, speed, coolant temperature, fuel level, throttle position, and engine load.
 * Uses ELM327 protocol for communication via Web Bluetooth.
 */

import {
  DEFAULT_POLL_INTERVAL,
  type GaugeColor,
  getGaugeColor,
  LIVE_DATA_PIDS,
  MAX_POLL_INTERVAL,
  MIN_POLL_INTERVAL,
  type ObdPid,
  PID_COOLANT_TEMP,
  PID_ENGINE_LOAD,
  PID_FUEL_LEVEL,
  PID_RPM,
  PID_SPEED,
  PID_THROTTLE,
  parseObdResponse,
} from '../utils/obdPids'
import type { OBDCharacteristics } from './useBluetoothOBD'

/** Response timeout in milliseconds */
const RESPONSE_TIMEOUT = 3000

/** Current values for all live data PIDs */
export interface LiveDataValues {
  rpm: number | null
  speed: number | null
  coolantTemp: number | null
  fuelLevel: number | null
  throttle: number | null
  engineLoad: number | null
}

/** Metadata for a live data value */
export interface LiveDataMeta {
  name: string
  unit: string
  min: number
  max: number
  color: GaugeColor
  formattedValue: string
}

/** Combined live data value with metadata for UI */
export interface LiveDataItem {
  value: number | null
  meta: LiveDataMeta
}

/** Configuration options for the composable */
export interface UseOBDLiveDataOptions {
  /** Polling interval in milliseconds (default: 1000, range: 200-10000) */
  pollInterval?: number
  /** Which PIDs to poll (default: all) */
  pidsToMonitor?: ObdPid[]
}

/**
 * Encode a command string to ArrayBuffer for BLE characteristic write
 */
function encodeCommand(cmd: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(`${cmd}\r`)
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
}

/**
 * Strip ELM327 prompts and clean response string
 */
function cleanResponse(raw: string): string {
  return raw
    .replace(/>/g, '')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Create default empty live data values
 */
function createEmptyValues(): LiveDataValues {
  return {
    rpm: null,
    speed: null,
    coolantTemp: null,
    fuelLevel: null,
    throttle: null,
    engineLoad: null,
  }
}

/**
 * Map PID code to LiveDataValues key
 */
function getPidKey(pid: ObdPid): keyof LiveDataValues | null {
  switch (pid.pid) {
    case '0C':
      return 'rpm'
    case '0D':
      return 'speed'
    case '05':
      return 'coolantTemp'
    case '2F':
      return 'fuelLevel'
    case '11':
      return 'throttle'
    case '04':
      return 'engineLoad'
    default:
      return null
  }
}

export function useOBDLiveData(
  characteristics: Ref<OBDCharacteristics | null>,
  options: UseOBDLiveDataOptions = {},
) {
  // Configuration
  const pollInterval = ref(
    Math.max(
      MIN_POLL_INTERVAL,
      Math.min(MAX_POLL_INTERVAL, options.pollInterval ?? DEFAULT_POLL_INTERVAL),
    ),
  )
  const pidsToMonitor = ref<ObdPid[]>(options.pidsToMonitor ?? [...LIVE_DATA_PIDS])

  // State
  const liveData = ref<LiveDataValues>(createEmptyValues())
  const isPolling = ref(false)
  const lastError = ref<string | null>(null)
  const lastUpdateTime = ref<Date | null>(null)
  const pollCount = ref(0)

  // Response buffer for accumulating BLE notifications
  let responseBuffer = ''
  let responseResolver: ((value: string) => void) | null = null
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
  let isShuttingDown = false

  /**
   * Handle incoming BLE characteristic notifications
   */
  function handleNotification(event: Event): void {
    const characteristic = event.target as { value?: DataView }
    if (!characteristic.value) return

    // Create a new Uint8Array from the DataView to decode
    const view = characteristic.value
    const bytes = new Uint8Array(view.byteLength)
    for (let i = 0; i < view.byteLength; i++) {
      bytes[i] = view.getUint8(i)
    }
    const chunk = new TextDecoder().decode(bytes)
    responseBuffer += chunk

    // ELM327 ends responses with '>' prompt
    if (responseBuffer.includes('>') && responseResolver) {
      responseResolver(responseBuffer)
      responseResolver = null
      responseBuffer = ''
    }
  }

  /**
   * Send a raw command to the OBD adapter and await response
   */
  async function sendCommand(cmd: string): Promise<string> {
    const chars = characteristics.value
    if (!chars?.write || !chars?.notify) {
      throw new Error('OBD adapter not connected')
    }

    const write = chars.write as { writeValue(data: BufferSource): Promise<void> }
    const notify = chars.notify as {
      addEventListener(type: string, handler: (e: Event) => void): void
      removeEventListener(type: string, handler: (e: Event) => void): void
    }

    // Clear buffer and set up notification handler
    responseBuffer = ''
    notify.addEventListener('characteristicvaluechanged', handleNotification)

    try {
      // Create a promise that resolves when we get a complete response
      const responsePromise = new Promise<string>((resolve, reject) => {
        responseResolver = resolve
        setTimeout(() => {
          if (responseResolver) {
            responseResolver = null
            reject(new Error('Response timeout'))
          }
        }, RESPONSE_TIMEOUT)
      })

      // Send the command
      await write.writeValue(encodeCommand(cmd))

      // Wait for response
      const raw = await responsePromise
      return cleanResponse(raw)
    } finally {
      notify.removeEventListener('characteristicvaluechanged', handleNotification)
      responseResolver = null
    }
  }

  /**
   * Read a single PID value
   */
  async function readPid(pid: ObdPid): Promise<number | null> {
    try {
      const response = await sendCommand(pid.command)

      // Handle no data
      if (response.includes('NODATA') || response.includes('NO DATA')) {
        return null
      }

      // Parse response bytes
      const bytes = parseObdResponse(response, pid.pid)
      if (bytes.length < pid.bytes) {
        return null
      }

      // Apply formula to convert raw bytes to value
      return pid.formula(bytes)
    } catch (err) {
      // Log but don't throw - we want polling to continue
      console.warn(`Failed to read PID ${pid.name}:`, err)
      return null
    }
  }

  /**
   * Poll all configured PIDs once
   */
  async function pollOnce(): Promise<LiveDataValues> {
    if (!characteristics.value) {
      lastError.value = 'OBD adapter not connected'
      return createEmptyValues()
    }

    const values = createEmptyValues()
    lastError.value = null

    for (const pid of pidsToMonitor.value) {
      if (isShuttingDown) break

      const key = getPidKey(pid)
      if (!key) continue

      const value = await readPid(pid)
      values[key] = value
    }

    liveData.value = values
    lastUpdateTime.value = new Date()
    pollCount.value++

    return values
  }

  /**
   * Internal polling loop
   */
  async function pollLoop(): Promise<void> {
    if (!isPolling.value || isShuttingDown) return

    try {
      await pollOnce()
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Polling failed'
    }

    // Schedule next poll
    if (isPolling.value && !isShuttingDown) {
      pollTimeoutId = setTimeout(pollLoop, pollInterval.value)
    }
  }

  /**
   * Start polling for live data
   */
  function startPolling(): void {
    if (isPolling.value) return
    if (!characteristics.value) {
      lastError.value = 'OBD adapter not connected'
      return
    }

    isShuttingDown = false
    isPolling.value = true
    lastError.value = null
    pollLoop()
  }

  /**
   * Stop polling for live data
   */
  function stopPolling(): void {
    isPolling.value = false
    isShuttingDown = true

    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId)
      pollTimeoutId = null
    }

    // Clear pending response promise
    if (responseResolver) {
      responseResolver = null
    }
  }

  /**
   * Update the polling interval
   * Clamped to MIN_POLL_INTERVAL - MAX_POLL_INTERVAL range
   */
  function setPollingInterval(intervalMs: number): void {
    pollInterval.value = Math.max(MIN_POLL_INTERVAL, Math.min(MAX_POLL_INTERVAL, intervalMs))
  }

  /**
   * Update which PIDs to monitor
   */
  function setPidsToMonitor(pids: ObdPid[]): void {
    pidsToMonitor.value = [...pids]
  }

  /**
   * Reset all values to null
   */
  function resetValues(): void {
    liveData.value = createEmptyValues()
    lastError.value = null
    pollCount.value = 0
    lastUpdateTime.value = null
  }

  /**
   * Get live data item with metadata for UI display
   */
  function getLiveDataItem(key: keyof LiveDataValues): LiveDataItem {
    const pidMap: Record<keyof LiveDataValues, ObdPid> = {
      rpm: PID_RPM,
      speed: PID_SPEED,
      coolantTemp: PID_COOLANT_TEMP,
      fuelLevel: PID_FUEL_LEVEL,
      throttle: PID_THROTTLE,
      engineLoad: PID_ENGINE_LOAD,
    }

    const pid = pidMap[key]
    const value = liveData.value[key]

    return {
      value,
      meta: {
        name: pid.name,
        unit: pid.unit,
        min: pid.min,
        max: pid.max,
        color: value !== null ? getGaugeColor(value, pid.min, pid.max, pid.name) : 'neutral',
        formattedValue:
          value !== null && pid.format ? pid.format(value) : (value?.toString() ?? '--'),
      },
    }
  }

  /**
   * Get all live data items with metadata
   */
  const liveDataItems = computed(() => ({
    rpm: getLiveDataItem('rpm'),
    speed: getLiveDataItem('speed'),
    coolantTemp: getLiveDataItem('coolantTemp'),
    fuelLevel: getLiveDataItem('fuelLevel'),
    throttle: getLiveDataItem('throttle'),
    engineLoad: getLiveDataItem('engineLoad'),
  }))

  // Watch for connection changes
  watch(
    () => characteristics.value,
    (chars) => {
      if (!chars && isPolling.value) {
        // Connection lost, stop polling
        stopPolling()
        lastError.value = 'Connection lost'
      }
    },
  )

  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
  })

  return {
    // State
    liveData: readonly(liveData),
    liveDataItems,
    isPolling: readonly(isPolling),
    lastError: readonly(lastError),
    lastUpdateTime: readonly(lastUpdateTime),
    pollCount: readonly(pollCount),
    pollInterval: readonly(pollInterval),

    // Configuration
    pidsToMonitor: readonly(pidsToMonitor),

    // Actions
    startPolling,
    stopPolling,
    pollOnce,
    setPollingInterval,
    setPidsToMonitor,
    resetValues,

    // Utilities
    getLiveDataItem,
  }
}
