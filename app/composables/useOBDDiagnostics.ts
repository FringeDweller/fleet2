/**
 * OBD-II Diagnostics Composable
 *
 * Provides DTC reading, clearing, and raw command functionality for OBD-II adapters.
 * Uses ELM327 protocol for communication via Web Bluetooth.
 */

import type { OBDCharacteristics } from './useBluetoothOBD'

export interface DTCCode {
  code: string
  codeType: 'P' | 'C' | 'B' | 'U'
  description: string
  severity: 'info' | 'warning' | 'critical'
  system: string
}

/** ELM327 OBD-II Mode commands */
const OBD_MODES = {
  READ_DTCS: '03',
  CLEAR_DTCS: '04',
  READ_PENDING: '07',
} as const

/** Response timeout in milliseconds */
const RESPONSE_TIMEOUT = 5000

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
 * Parse Mode 03/07 DTC response into hex code pairs
 * Response format: "43 XX XX XX XX" where 43 is mode+40
 */
function parseDtcHexCodes(response: string): string[] {
  const clean = response.replace(/\s/g, '').toUpperCase()

  // Mode 03 response starts with 43, Mode 07 with 47
  if (!clean.startsWith('43') && !clean.startsWith('47')) {
    return []
  }

  // Remove header (first 2 chars)
  const data = clean.slice(2)
  const codes: string[] = []

  // Each DTC is 4 hex chars (2 bytes)
  for (let i = 0; i + 4 <= data.length; i += 4) {
    const hex = data.slice(i, i + 4)
    if (hex !== '0000') {
      codes.push(hex)
    }
  }

  return codes
}

/**
 * Convert 4-char hex to standard DTC format (e.g., "0300" -> "P0300")
 */
function hexToDtcCode(hex: string): string | null {
  if (hex.length !== 4) return null

  const firstNibble = parseInt(hex[0]!, 16)
  const rest = hex.slice(1)

  // First nibble high bits determine code type
  const typeMap: Record<number, string> = { 0: 'P', 1: 'C', 2: 'B', 3: 'U' }
  const typeIndex = Math.floor(firstNibble / 4)
  const prefix = typeMap[typeIndex] ?? 'P'

  // First nibble low bits are first digit of code
  const firstDigit = (firstNibble % 4).toString()

  return `${prefix}${firstDigit}${rest}`
}

/**
 * Determine DTC severity based on code patterns
 */
function getDtcSeverity(code: string): 'info' | 'warning' | 'critical' {
  const prefix = code[0]?.toUpperCase() ?? 'P'

  // Critical: misfires, fuel system, transmission
  if (prefix === 'P') {
    if (code.startsWith('P030') || code.startsWith('P031')) return 'critical'
    if (code.startsWith('P017') || code.startsWith('P018')) return 'critical'
    if (code.startsWith('P07')) return 'critical'
  }

  // Chassis critical: brake, stability control
  if (prefix === 'C' && code.match(/^C0[0-2]/)) return 'critical'

  // Body/Network are typically informational
  if (prefix === 'B') return 'info'
  if (prefix === 'U' && !code.startsWith('U01')) return 'info'

  return 'warning'
}

/**
 * Get system name from code type
 */
function getSystemName(codeType: string): string {
  const systems: Record<string, string> = {
    P: 'Powertrain',
    C: 'Chassis',
    B: 'Body',
    U: 'Network',
  }
  return systems[codeType] ?? 'Unknown'
}

export function useOBDDiagnostics(characteristics: Ref<OBDCharacteristics | null>) {
  const dtcCodes = ref<DTCCode[]>([])
  const isReading = ref(false)
  const lastError = ref<string | null>(null)

  // Response buffer for accumulating BLE notifications
  let responseBuffer = ''
  let responseResolver: ((value: string) => void) | null = null

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
      lastError.value = 'OBD adapter not connected'
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
   * Read stored DTCs from the vehicle (Mode 03)
   */
  async function readDTCs(): Promise<DTCCode[]> {
    if (isReading.value) {
      return dtcCodes.value
    }

    isReading.value = true
    lastError.value = null
    dtcCodes.value = []

    try {
      const response = await sendCommand(OBD_MODES.READ_DTCS)

      // Handle no codes
      if (response.includes('NODATA') || response.includes('NO DATA')) {
        return []
      }

      // Parse hex codes from response
      const hexCodes = parseDtcHexCodes(response)
      const codes: DTCCode[] = []

      for (const hex of hexCodes) {
        const code = hexToDtcCode(hex)
        if (code) {
          const codeType = code[0] as 'P' | 'C' | 'B' | 'U'
          codes.push({
            code,
            codeType,
            description: `${getSystemName(codeType)} fault - ${code}`,
            severity: getDtcSeverity(code),
            system: getSystemName(codeType),
          })
        }
      }

      dtcCodes.value = codes
      return codes
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Failed to read DTCs'
      return []
    } finally {
      isReading.value = false
    }
  }

  /**
   * Clear stored DTCs (Mode 04)
   * Returns true if successful
   */
  async function clearDTCs(): Promise<boolean> {
    if (isReading.value) {
      return false
    }

    isReading.value = true
    lastError.value = null

    try {
      const response = await sendCommand(OBD_MODES.CLEAR_DTCS)

      // Mode 04 returns 44 on success
      if (response.includes('44')) {
        dtcCodes.value = []
        return true
      }

      // Check for errors
      if (response.includes('?') || response.includes('ERROR')) {
        lastError.value = 'Clear command rejected by vehicle'
        return false
      }

      // Assume success if no error
      dtcCodes.value = []
      return true
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Failed to clear DTCs'
      return false
    } finally {
      isReading.value = false
    }
  }

  return {
    // State
    dtcCodes: readonly(dtcCodes),
    isReading: readonly(isReading),
    lastError: readonly(lastError),

    // Actions
    readDTCs,
    clearDTCs,
    sendCommand,
  }
}
