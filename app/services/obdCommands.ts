/**
 * OBD-II Command Service
 *
 * Handles communication with ELM327-compatible OBD-II adapters via Web Bluetooth or Serial.
 * Implements OBD-II PIDs for reading and clearing diagnostic trouble codes (DTCs).
 */

// Web Bluetooth API type declarations
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>
    }
    serial?: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
    }
  }

  interface BluetoothRequestDeviceOptions {
    filters?: Array<{
      namePrefix?: string
      name?: string
      services?: string[]
    }>
    optionalServices?: string[]
    acceptAllDevices?: boolean
  }

  interface BluetoothDevice {
    name?: string
    gatt?: BluetoothRemoteGATTServer
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

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    value?: DataView
    writeValue(value: BufferSource): Promise<void>
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  }

  interface SerialPortRequestOptions {
    filters?: Array<{
      usbVendorId?: number
      usbProductId?: number
    }>
  }

  interface SerialPort {
    readable?: ReadableStream<Uint8Array>
    writable?: WritableStream<Uint8Array>
    open(options: { baudRate: number }): Promise<void>
    close(): Promise<void>
  }
}

export interface ObdConnection {
  type: 'bluetooth' | 'serial' | 'mock'
  device?: BluetoothDevice
  port?: SerialPort
  characteristic?: BluetoothRemoteGATTCharacteristic
  reader?: ReadableStreamDefaultReader<Uint8Array>
  writer?: WritableStreamDefaultWriter<Uint8Array>
}

export interface ObdResponse {
  success: boolean
  data?: string
  error?: string
  rawResponse?: string
}

export interface DtcReadResult {
  success: boolean
  codes: ParsedDtc[]
  rawResponse?: string
  error?: string
}

export interface ParsedDtc {
  code: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  system: string
  possibleCauses?: string[]
}

export interface ClearDtcResult {
  success: boolean
  message?: string
  error?: string
}

// Common ELM327 UUIDs for Bluetooth adapters
const ELM327_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
const ELM327_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb'

// Alternative OBD-II Bluetooth service UUIDs
const ALT_SERVICE_UUIDS = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // SPP
]

/**
 * ELM327 AT Commands for initialization
 */
export const ELM327_COMMANDS = {
  RESET: 'ATZ', // Reset device
  ECHO_OFF: 'ATE0', // Disable echo
  HEADERS_OFF: 'ATH0', // Disable headers
  AUTO_PROTOCOL: 'ATSP0', // Auto-detect protocol
  LINEFEED_OFF: 'ATL0', // Disable linefeeds
  SPACES_OFF: 'ATS0', // Disable spaces
  ADAPTIVE_TIMING: 'ATAT1', // Adaptive timing on
  TIMEOUT: 'ATST96', // Set timeout (150 * 4ms = 600ms)
}

/**
 * OBD-II Mode PIDs
 */
export const OBD_MODES = {
  READ_DTCS: '03', // Mode 03: Request stored DTCs
  CLEAR_DTCS: '04', // Mode 04: Clear DTCs and freeze frame data
  READ_PENDING_DTCS: '07', // Mode 07: Request pending DTCs
  REQUEST_VEHICLE_INFO: '09', // Mode 09: Request vehicle information
}

/**
 * Send a command to the OBD-II device and wait for response
 */
async function sendCommand(
  connection: ObdConnection,
  command: string,
  timeout: number = 3000,
): Promise<ObdResponse> {
  if (connection.type === 'mock') {
    return mockSendCommand(command)
  }

  try {
    const encoder = new TextEncoder()
    const commandWithCr = `${command}\r`

    if (connection.type === 'bluetooth' && connection.characteristic) {
      // Bluetooth: Write to characteristic
      await connection.characteristic.writeValue(encoder.encode(commandWithCr))

      // Wait for response with timeout
      const response = await waitForBluetoothResponse(connection, timeout)
      return { success: true, data: response, rawResponse: response }
    }

    if (connection.type === 'serial' && connection.writer && connection.reader) {
      // Serial: Write to port
      await connection.writer.write(encoder.encode(commandWithCr))

      // Wait for response with timeout
      const response = await waitForSerialResponse(connection, timeout)
      return { success: true, data: response, rawResponse: response }
    }

    return { success: false, error: 'No active connection' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command failed',
    }
  }
}

/**
 * Wait for Bluetooth response
 */
async function waitForBluetoothResponse(
  connection: ObdConnection,
  timeout: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let response = ''
    const timeoutId = setTimeout(() => {
      reject(new Error('Response timeout'))
    }, timeout)

    // Set up notification listener
    const handleNotification = (event: Event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value
      if (value) {
        const decoder = new TextDecoder()
        response += decoder.decode(value)

        // Check for end of response (> prompt)
        if (response.includes('>')) {
          clearTimeout(timeoutId)
          connection.characteristic?.removeEventListener(
            'characteristicvaluechanged',
            handleNotification,
          )
          resolve(response.replace('>', '').trim())
        }
      }
    }

    connection.characteristic?.addEventListener('characteristicvaluechanged', handleNotification)
    connection.characteristic?.startNotifications()
  })
}

/**
 * Wait for Serial response
 */
async function waitForSerialResponse(connection: ObdConnection, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!connection.reader) {
      reject(new Error('No reader available'))
      return
    }

    let response = ''
    const decoder = new TextDecoder()
    const timeoutId = setTimeout(() => {
      reject(new Error('Response timeout'))
    }, timeout)

    const readLoop = async () => {
      try {
        while (true) {
          const { value, done } = await connection.reader!.read()
          if (done) break

          response += decoder.decode(value)

          // Check for end of response (> prompt)
          if (response.includes('>')) {
            clearTimeout(timeoutId)
            resolve(response.replace('>', '').trim())
            return
          }
        }
      } catch (_error) {
        clearTimeout(timeoutId)
        reject(new Error('Read error'))
      }
    }

    readLoop()
  })
}

/**
 * Mock command handler for testing without real OBD device
 */
function mockSendCommand(command: string): ObdResponse {
  switch (command) {
    case 'ATZ':
      return { success: true, data: 'ELM327 v1.5', rawResponse: 'ELM327 v1.5' }
    case 'ATE0':
    case 'ATH0':
    case 'ATSP0':
    case 'ATL0':
    case 'ATS0':
    case 'ATAT1':
    case 'ATST96':
      return { success: true, data: 'OK', rawResponse: 'OK' }
    case '03':
      // Mock DTCs: P0300 (Random Misfire), P0420 (Catalyst Efficiency)
      return { success: true, data: '43 03 00 04 20', rawResponse: '43 03 00 04 20' }
    case '04':
      return { success: true, data: '44', rawResponse: '44' }
    default:
      return { success: true, data: 'NO DATA', rawResponse: 'NO DATA' }
  }
}

/**
 * Initialize ELM327 device with standard AT commands
 */
export async function initializeElm327(connection: ObdConnection): Promise<ObdResponse> {
  const initCommands = [
    ELM327_COMMANDS.RESET,
    ELM327_COMMANDS.ECHO_OFF,
    ELM327_COMMANDS.LINEFEED_OFF,
    ELM327_COMMANDS.HEADERS_OFF,
    ELM327_COMMANDS.SPACES_OFF,
    ELM327_COMMANDS.ADAPTIVE_TIMING,
    ELM327_COMMANDS.TIMEOUT,
    ELM327_COMMANDS.AUTO_PROTOCOL,
  ]

  for (const cmd of initCommands) {
    const result = await sendCommand(connection, cmd, 5000)
    if (!result.success) {
      return { success: false, error: `Initialization failed at ${cmd}: ${result.error}` }
    }

    // Special handling for reset - wait for device to be ready
    if (cmd === ELM327_COMMANDS.RESET) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return { success: true, data: 'ELM327 initialized successfully' }
}

/**
 * Read stored DTCs (Mode 03)
 */
export async function readDtcs(connection: ObdConnection): Promise<DtcReadResult> {
  const response = await sendCommand(connection, OBD_MODES.READ_DTCS, 5000)

  if (!response.success) {
    return { success: false, codes: [], error: response.error }
  }

  // Check for no codes
  if (response.data === 'NO DATA' || response.data === 'NODATA') {
    return { success: true, codes: [], rawResponse: response.rawResponse }
  }

  // Parse the DTC response
  const dtcStrings = parseObdDtcResponse(response.data || '')

  // Look up each code to get full details
  const codes: ParsedDtc[] = dtcStrings.map((code) => {
    const definition = lookupDtcCode(code)
    return {
      code: definition.code,
      description: definition.description,
      severity: definition.severity,
      system: definition.system,
      possibleCauses: definition.possibleCauses,
    }
  })

  return { success: true, codes, rawResponse: response.rawResponse }
}

/**
 * Read pending DTCs (Mode 07)
 */
export async function readPendingDtcs(connection: ObdConnection): Promise<DtcReadResult> {
  const response = await sendCommand(connection, OBD_MODES.READ_PENDING_DTCS, 5000)

  if (!response.success) {
    return { success: false, codes: [], error: response.error }
  }

  if (response.data === 'NO DATA' || response.data === 'NODATA') {
    return { success: true, codes: [], rawResponse: response.rawResponse }
  }

  // Parse the DTC response (Mode 07 uses same format as Mode 03)
  const dtcStrings = parseObdDtcResponse(response.data || '')

  const codes: ParsedDtc[] = dtcStrings.map((code) => {
    const definition = lookupDtcCode(code)
    return {
      code: definition.code,
      description: definition.description,
      severity: definition.severity,
      system: definition.system,
      possibleCauses: definition.possibleCauses,
    }
  })

  return { success: true, codes, rawResponse: response.rawResponse }
}

/**
 * Clear DTCs (Mode 04)
 * WARNING: This also clears freeze frame data and resets monitors
 */
export async function clearDtcs(connection: ObdConnection): Promise<ClearDtcResult> {
  const response = await sendCommand(connection, OBD_MODES.CLEAR_DTCS, 5000)

  if (!response.success) {
    return { success: false, error: response.error }
  }

  // Mode 04 returns 44 on success
  if (response.data?.includes('44')) {
    return { success: true, message: 'DTCs cleared successfully' }
  }

  // Check for error responses
  if (response.data?.includes('?') || response.data?.includes('ERROR')) {
    return { success: false, error: 'Clear command rejected by vehicle' }
  }

  return { success: true, message: 'Clear command sent' }
}

/**
 * Connect to OBD-II device via Web Bluetooth
 */
export async function connectBluetooth(): Promise<ObdConnection | null> {
  if (!navigator.bluetooth) {
    console.error('Web Bluetooth not supported')
    return null
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'OBD' },
        { namePrefix: 'ELM' },
        { namePrefix: 'OBDII' },
        { namePrefix: 'Vgate' },
        { namePrefix: 'iCar' },
      ],
      optionalServices: [ELM327_SERVICE_UUID, ...ALT_SERVICE_UUIDS],
    })

    const server = await device.gatt?.connect()
    if (!server) {
      throw new Error('Failed to connect to GATT server')
    }

    // Try to find the service
    let service: BluetoothRemoteGATTService | null = null
    for (const uuid of [ELM327_SERVICE_UUID, ...ALT_SERVICE_UUIDS]) {
      try {
        service = await server.getPrimaryService(uuid)
        break
      } catch {
        // Try next UUID
      }
    }

    if (!service) {
      throw new Error('OBD service not found')
    }

    const characteristic = await service.getCharacteristic(ELM327_CHARACTERISTIC_UUID)

    return {
      type: 'bluetooth',
      device,
      characteristic,
    }
  } catch (error) {
    console.error('Bluetooth connection failed:', error)
    return null
  }
}

/**
 * Connect to OBD-II device via Web Serial
 */
export async function connectSerial(): Promise<ObdConnection | null> {
  if (!navigator.serial) {
    console.error('Web Serial not supported')
    return null
  }

  try {
    const port = await navigator.serial.requestPort({
      filters: [
        { usbVendorId: 0x0403 }, // FTDI
        { usbVendorId: 0x067b }, // Prolific
        { usbVendorId: 0x10c4 }, // Silicon Labs
      ],
    })

    await port.open({ baudRate: 38400 })

    const reader = port.readable?.getReader()
    const writer = port.writable?.getWriter()

    if (!reader || !writer) {
      throw new Error('Failed to get reader/writer')
    }

    return {
      type: 'serial',
      port,
      reader,
      writer,
    }
  } catch (error) {
    console.error('Serial connection failed:', error)
    return null
  }
}

/**
 * Create a mock connection for testing
 */
export function createMockConnection(): ObdConnection {
  return { type: 'mock' }
}

/**
 * Disconnect from OBD-II device
 */
export async function disconnect(connection: ObdConnection): Promise<void> {
  if (connection.type === 'bluetooth' && connection.device?.gatt?.connected) {
    connection.device.gatt.disconnect()
  }

  if (connection.type === 'serial' && connection.port) {
    try {
      connection.reader?.releaseLock()
      connection.writer?.releaseLock()
      await connection.port.close()
    } catch (error) {
      console.error('Error closing serial port:', error)
    }
  }
}

/**
 * Check if Web Bluetooth is available
 */
export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

/**
 * Check if Web Serial is available
 */
export function isSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

// ============================================================================
// DTC Code Parsing and Lookup Functions
// ============================================================================

type DtcSeverity = 'info' | 'warning' | 'critical'
type DtcCodeType = 'P' | 'C' | 'B' | 'U'

interface DtcDefinition {
  code: string
  description: string
  severity: DtcSeverity
  system: string
  possibleCauses?: string[]
}

/**
 * Determine the severity of a DTC code based on its characteristics
 */
function getDtcSeverity(code: string): DtcSeverity {
  const prefix = code.charAt(0).toUpperCase()
  const subsystem = code.charAt(2)

  // Critical codes - engine/transmission failures that could cause damage
  if (prefix === 'P') {
    if (code.startsWith('P030') || code.startsWith('P031')) return 'critical'
    if (code.startsWith('P017') || code.startsWith('P018')) return 'critical'
    if (code.startsWith('P07')) return 'critical'
    if (code.startsWith('P011') || code.startsWith('P012')) return 'critical'
    if (code.startsWith('P052')) return 'critical'
  }

  if (prefix === 'C') {
    if (code.match(/^C00[345]/)) return 'critical'
    if (code.startsWith('C01') || code.startsWith('C02')) return 'critical'
  }

  if (prefix === 'P' && (subsystem === '0' || subsystem === '4')) return 'warning'
  if (prefix === 'B') {
    if (code.startsWith('B00') || code.startsWith('B01')) return 'critical'
    return 'info'
  }
  if (prefix === 'U') {
    if (code.startsWith('U01')) return 'warning'
    return 'info'
  }

  return 'warning'
}

/**
 * Get the code type from a DTC code string
 */
function getDtcCodeType(code: string): DtcCodeType {
  const prefix = code.charAt(0).toUpperCase()
  if (prefix === 'P' || prefix === 'C' || prefix === 'B' || prefix === 'U') {
    return prefix as DtcCodeType
  }
  return 'P'
}

/**
 * Get the system name for a code type
 */
function getSystemName(codeType: DtcCodeType): string {
  switch (codeType) {
    case 'P':
      return 'Powertrain'
    case 'C':
      return 'Chassis'
    case 'B':
      return 'Body'
    case 'U':
      return 'Network'
    default:
      return 'Unknown'
  }
}

/**
 * Common DTC definitions for client-side lookup
 */
const DTC_CODES: Record<string, DtcDefinition> = {
  P0300: {
    code: 'P0300',
    description: 'Random/Multiple Cylinder Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
    possibleCauses: ['Spark plugs', 'Ignition coils', 'Fuel injector', 'Vacuum leak'],
  },
  P0301: {
    code: 'P0301',
    description: 'Cylinder 1 Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0420: {
    code: 'P0420',
    description: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    severity: 'warning',
    system: 'Emission Controls',
    possibleCauses: ['Failing catalytic converter', 'Exhaust leak', 'O2 sensor issue'],
  },
  P0171: {
    code: 'P0171',
    description: 'System Too Lean (Bank 1)',
    severity: 'critical',
    system: 'Fuel Trim',
    possibleCauses: ['Vacuum leak', 'Fuel pressure issue', 'MAF sensor problem'],
  },
  P0172: {
    code: 'P0172',
    description: 'System Too Rich (Bank 1)',
    severity: 'critical',
    system: 'Fuel Trim',
  },
  U0100: {
    code: 'U0100',
    description: 'Lost Communication With ECM/PCM A',
    severity: 'critical',
    system: 'CAN Bus',
  },
}

/**
 * Look up a DTC definition by code
 */
function lookupDtcCode(code: string): DtcDefinition {
  const normalizedCode = code.toUpperCase().trim()

  if (DTC_CODES[normalizedCode]) {
    return DTC_CODES[normalizedCode]
  }

  const codeType = getDtcCodeType(normalizedCode)
  const severity = getDtcSeverity(normalizedCode)
  const system = getSystemName(codeType)

  let description = `${system} Fault - Code ${normalizedCode}`
  if (codeType === 'P') {
    const subsystem = normalizedCode.charAt(2)
    const subsystemNames: Record<string, string> = {
      '0': 'Fuel and Air Metering',
      '1': 'Fuel and Air Metering',
      '2': 'Fuel Injection System',
      '3': 'Ignition System',
      '4': 'Emission Controls',
      '5': 'Speed Control and Idle Control',
      '6': 'Computer Output Circuit',
      '7': 'Transmission',
      '8': 'Transmission',
    }
    if (subsystemNames[subsystem]) {
      description = `${subsystemNames[subsystem]} - ${normalizedCode}`
    }
  }

  return { code: normalizedCode, description, severity, system }
}

/**
 * Convert hex bytes to DTC code string
 */
function hexToDtcCode(hex: string): string | null {
  if (hex.length !== 4) return null

  const firstNibble = parseInt(hex.charAt(0), 16)
  const rest = hex.substring(1)

  let prefix: string
  switch (Math.floor(firstNibble / 4)) {
    case 0:
      prefix = 'P'
      break
    case 1:
      prefix = 'C'
      break
    case 2:
      prefix = 'B'
      break
    case 3:
      prefix = 'U'
      break
    default:
      prefix = 'P'
  }

  const firstDigit = (firstNibble % 4).toString()
  return `${prefix}${firstDigit}${rest}`
}

/**
 * Parse raw OBD-II DTC response into code strings
 */
function parseObdDtcResponse(response: string): string[] {
  const codes: string[] = []
  const cleanResponse = response.replace(/[\s\r\n]/g, '').toUpperCase()

  let data = cleanResponse
  if (data.startsWith('43')) {
    data = data.substring(2)
  }

  for (let i = 0; i < data.length; i += 4) {
    if (i + 4 <= data.length) {
      const dtcHex = data.substring(i, i + 4)
      if (dtcHex === '0000') continue
      const code = hexToDtcCode(dtcHex)
      if (code) {
        codes.push(code)
      }
    }
  }

  return codes
}

// ============================================================================
// Live Data Types and Service (US-10.5)
// ============================================================================

/**
 * Live data values from OBD-II PIDs
 */
export interface LiveDataValues {
  rpm: number | null
  speed: number | null
  coolantTemp: number | null
  fuelLevel: number | null
  throttle: number | null
  throttlePosition?: number | null
  engineLoad?: number | null
  intakeTemp?: number | null
  batteryVoltage?: number | null
}

/**
 * OBD Commands Service for live data polling
 */
export interface ObdCommandsService {
  sendCommand(command: string): Promise<ObdResponse>
  readLiveData(): Promise<LiveDataValues>
  readAllLiveData(): Promise<LiveDataValues>
  isInitialized: boolean
  initialize(): Promise<boolean>
  lastError: string | null
}

let commandsServiceInstance: ObdCommandsService | null = null

const emptyLiveData: LiveDataValues = {
  rpm: null,
  speed: null,
  coolantTemp: null,
  fuelLevel: null,
  throttle: null,
}

/**
 * Get the OBD commands service singleton
 * Note: This is a placeholder for US-10.5 implementation
 */
export function getObdCommandsService(): ObdCommandsService {
  if (!commandsServiceInstance) {
    commandsServiceInstance = {
      isInitialized: false,
      lastError: null,
      async sendCommand(_command: string): Promise<ObdResponse> {
        // Placeholder - will be implemented with actual connection
        console.warn('OBD commands service not fully implemented')
        return { success: false, error: 'Not connected' }
      },
      async readLiveData(): Promise<LiveDataValues> {
        // Placeholder - will be implemented with actual connection
        return { ...emptyLiveData }
      },
      async readAllLiveData(): Promise<LiveDataValues> {
        // Placeholder - will be implemented with actual connection
        return { ...emptyLiveData }
      },
      async initialize(): Promise<boolean> {
        // Placeholder - will be implemented with actual connection
        this.isInitialized = true
        return true
      },
    }
  }
  return commandsServiceInstance
}
