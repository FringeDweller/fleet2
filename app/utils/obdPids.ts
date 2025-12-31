/**
 * OBD-II PID Constants and Formulas (US-10.5)
 *
 * Mode 01 (Current Data) PIDs for real-time vehicle monitoring.
 * Each PID includes its code, description, and formula to convert
 * raw bytes to human-readable values.
 */

export interface ObdPid {
  /** Full PID command (mode + PID code) */
  command: string
  /** PID code without mode */
  pid: string
  /** Human-readable name */
  name: string
  /** Unit of measurement */
  unit: string
  /** Description of what this PID measures */
  description: string
  /** Minimum value for gauges */
  min: number
  /** Maximum value for gauges */
  max: number
  /** Number of expected data bytes in response */
  bytes: number
  /** Formula to convert raw bytes to value */
  formula: (bytes: number[]) => number
  /** Format function for display (optional) */
  format?: (value: number) => string
}

/**
 * Engine RPM (PID 0C)
 * Formula: ((A * 256) + B) / 4
 * Range: 0 - 16,383.75 rpm
 */
export const PID_RPM: ObdPid = {
  command: '010C',
  pid: '0C',
  name: 'Engine RPM',
  unit: 'rpm',
  description: 'Engine revolutions per minute',
  min: 0,
  max: 8000,
  bytes: 2,
  formula: (bytes) => {
    if (bytes.length < 2) return 0
    return (bytes[0]! * 256 + bytes[1]!) / 4
  },
  format: (value) => Math.round(value).toLocaleString(),
}

/**
 * Vehicle Speed (PID 0D)
 * Formula: A
 * Range: 0 - 255 km/h
 */
export const PID_SPEED: ObdPid = {
  command: '010D',
  pid: '0D',
  name: 'Vehicle Speed',
  unit: 'km/h',
  description: 'Current vehicle speed',
  min: 0,
  max: 220,
  bytes: 1,
  formula: (bytes) => {
    if (bytes.length < 1) return 0
    return bytes[0]!
  },
  format: (value) => Math.round(value).toString(),
}

/**
 * Coolant Temperature (PID 05)
 * Formula: A - 40
 * Range: -40 to 215 °C
 */
export const PID_COOLANT_TEMP: ObdPid = {
  command: '0105',
  pid: '05',
  name: 'Coolant Temperature',
  unit: '°C',
  description: 'Engine coolant temperature',
  min: -40,
  max: 140,
  bytes: 1,
  formula: (bytes) => {
    if (bytes.length < 1) return 0
    return bytes[0]! - 40
  },
  format: (value) => Math.round(value).toString(),
}

/**
 * Fuel Tank Level Input (PID 2F)
 * Formula: (A * 100) / 255
 * Range: 0 - 100%
 */
export const PID_FUEL_LEVEL: ObdPid = {
  command: '012F',
  pid: '2F',
  name: 'Fuel Level',
  unit: '%',
  description: 'Fuel tank level percentage',
  min: 0,
  max: 100,
  bytes: 1,
  formula: (bytes) => {
    if (bytes.length < 1) return 0
    return (bytes[0]! * 100) / 255
  },
  format: (value) => Math.round(value).toString(),
}

/**
 * Throttle Position (PID 11)
 * Formula: (A * 100) / 255
 * Range: 0 - 100%
 */
export const PID_THROTTLE: ObdPid = {
  command: '0111',
  pid: '11',
  name: 'Throttle Position',
  unit: '%',
  description: 'Throttle position percentage',
  min: 0,
  max: 100,
  bytes: 1,
  formula: (bytes) => {
    if (bytes.length < 1) return 0
    return (bytes[0]! * 100) / 255
  },
  format: (value) => Math.round(value).toString(),
}

/**
 * All live data PIDs in order of priority for polling
 */
export const LIVE_DATA_PIDS: readonly ObdPid[] = [
  PID_RPM,
  PID_SPEED,
  PID_COOLANT_TEMP,
  PID_FUEL_LEVEL,
  PID_THROTTLE,
] as const

/**
 * Map of PID codes to their definitions
 */
export const PID_MAP: Record<string, ObdPid> = {
  '0C': PID_RPM,
  '0D': PID_SPEED,
  '05': PID_COOLANT_TEMP,
  '2F': PID_FUEL_LEVEL,
  '11': PID_THROTTLE,
}

/**
 * Default polling interval in milliseconds
 */
export const DEFAULT_POLL_INTERVAL = 1000

/**
 * Minimum polling interval in milliseconds
 */
export const MIN_POLL_INTERVAL = 200

/**
 * Maximum polling interval in milliseconds
 */
export const MAX_POLL_INTERVAL = 10000

/**
 * Parse an OBD-II response string into raw bytes
 * Response format: "41 0C 1A F8" (response header + data)
 */
export function parseObdResponse(response: string, expectedPid: string): number[] {
  // Remove spaces and convert to uppercase
  const clean = response.replace(/\s/g, '').toUpperCase()

  // Response should start with "41" (mode 01 response) followed by PID
  const expectedPrefix = `41${expectedPid.toUpperCase()}`
  if (!clean.startsWith(expectedPrefix)) {
    return []
  }

  // Extract data bytes (everything after the prefix)
  const dataHex = clean.slice(expectedPrefix.length)

  // Parse hex pairs into bytes
  const bytes: number[] = []
  for (let i = 0; i < dataHex.length; i += 2) {
    const hex = dataHex.slice(i, i + 2)
    const byte = parseInt(hex, 16)
    if (!Number.isNaN(byte)) {
      bytes.push(byte)
    }
  }

  return bytes
}

/**
 * Color type for gauge visualization
 */
export type GaugeColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

/**
 * Get color for a gauge based on value percentage
 */
export function getGaugeColor(
  value: number,
  min: number,
  max: number,
  pidName: string,
): GaugeColor {
  const percentage = ((value - min) / (max - min)) * 100

  // Special handling for temperature (danger when hot)
  if (pidName === 'Coolant Temperature') {
    if (value >= 110) return 'error' // Critical
    if (value >= 100) return 'warning' // Hot
    if (value < 50) return 'info' // Cold
    return 'success' // Normal operating range
  }

  // For RPM - redline warning
  if (pidName === 'Engine RPM') {
    if (value >= 6500) return 'error' // Redline
    if (value >= 5500) return 'warning' // Near redline
    return 'primary'
  }

  // Default gradient for percentage values (fuel, throttle)
  if (pidName === 'Fuel Level') {
    if (percentage <= 10) return 'error' // Very low
    if (percentage <= 25) return 'warning' // Low
    return 'success'
  }

  // Throttle - just show activity level
  if (pidName === 'Throttle Position') {
    if (percentage >= 90) return 'error'
    if (percentage >= 70) return 'warning'
    return 'primary'
  }

  // Speed - informational
  return 'primary'
}
