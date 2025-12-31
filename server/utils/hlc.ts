/**
 * Hybrid Logical Clock (HLC) implementation for server-side offline-first synchronization.
 *
 * HLC combines physical time with logical counters to provide:
 * - Causally ordered timestamps even with clock drift
 * - Unique identifiers across distributed nodes
 * - Monotonically increasing timestamps
 *
 * Format: ${physicalTime}:${logicalCounter}:${nodeId}
 * - physicalTime: Unix timestamp in milliseconds
 * - logicalCounter: 16-bit counter for same-millisecond ordering
 * - nodeId: 8-character unique identifier
 *
 * Reference: https://cse.buffalo.edu/tech-reports/2014-04.pdf
 */

import { createHash, randomBytes } from 'node:crypto'
import { hostname } from 'node:os'

/** Maximum value for the 16-bit logical counter */
const MAX_COUNTER = 0xffff

/** Length of node ID in characters */
const NODE_ID_LENGTH = 8

/**
 * Parsed HLC timestamp components
 */
export interface HLCTimestamp {
  /** Physical time in milliseconds since Unix epoch */
  physicalTime: number
  /** Logical counter for same-millisecond ordering (0-65535) */
  counter: number
  /** 8-character unique identifier for the node */
  nodeId: string
}

/**
 * Serialized HLC timestamp string format
 */
export type HLCString = string

/**
 * Generate a random 8-character node ID using crypto.randomBytes.
 */
export function generateNodeId(): string {
  const bytes = randomBytes(6)
  return BigInt(`0x${bytes.toString('hex')}`)
    .toString(36)
    .slice(0, NODE_ID_LENGTH)
    .padStart(NODE_ID_LENGTH, '0')
}

/**
 * Generate a stable server node ID based on hostname and process ID.
 * This ensures the same server instance gets the same node ID across restarts,
 * while different instances (processes) get different IDs.
 */
export function generateStableServerNodeId(): string {
  const host = hostname()
  const pid = process.pid
  const startTime = process.hrtime.bigint().toString()

  // Create a hash of identifying information
  const hash = createHash('sha256').update(`${host}:${pid}:${startTime}`).digest('hex')

  // Convert first 12 hex chars to base36 and take 8 chars
  return BigInt(`0x${hash.slice(0, 12)}`)
    .toString(36)
    .slice(0, NODE_ID_LENGTH)
    .padStart(NODE_ID_LENGTH, '0')
}

/**
 * Parse an HLC string into its components.
 * @param hlcString - Serialized HLC timestamp (e.g., "1704067200000:0:abc12345")
 * @returns Parsed HLC timestamp components
 * @throws Error if the format is invalid
 */
export function parseHLC(hlcString: HLCString): HLCTimestamp {
  const parts = hlcString.split(':')
  if (parts.length !== 3) {
    throw new Error(`Invalid HLC format: expected 3 parts, got ${parts.length}`)
  }

  const [physicalTimeStr, counterStr, nodeId] = parts

  const physicalTime = Number.parseInt(physicalTimeStr!, 10)
  if (Number.isNaN(physicalTime) || physicalTime < 0) {
    throw new Error(`Invalid HLC physical time: ${physicalTimeStr}`)
  }

  const counter = Number.parseInt(counterStr!, 10)
  if (Number.isNaN(counter) || counter < 0 || counter > MAX_COUNTER) {
    throw new Error(`Invalid HLC counter: ${counterStr}`)
  }

  if (!nodeId || nodeId.length !== NODE_ID_LENGTH) {
    throw new Error(`Invalid HLC node ID: expected ${NODE_ID_LENGTH} characters`)
  }

  return { physicalTime, counter, nodeId: nodeId! }
}

/**
 * Serialize HLC components into a string.
 * @param timestamp - HLC timestamp components
 * @returns Serialized HLC string
 */
export function serializeHLC(timestamp: HLCTimestamp): HLCString {
  return `${timestamp.physicalTime}:${timestamp.counter}:${timestamp.nodeId}`
}

/**
 * Compare two HLC timestamps.
 * @param a - First HLC timestamp (string or parsed)
 * @param b - Second HLC timestamp (string or parsed)
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareHLC(a: HLCString | HLCTimestamp, b: HLCString | HLCTimestamp): -1 | 0 | 1 {
  const parsedA = typeof a === 'string' ? parseHLC(a) : a
  const parsedB = typeof b === 'string' ? parseHLC(b) : b

  // Compare physical time first
  if (parsedA.physicalTime < parsedB.physicalTime) return -1
  if (parsedA.physicalTime > parsedB.physicalTime) return 1

  // Physical times are equal, compare counters
  if (parsedA.counter < parsedB.counter) return -1
  if (parsedA.counter > parsedB.counter) return 1

  // Physical time and counter are equal, compare node IDs for total ordering
  if (parsedA.nodeId < parsedB.nodeId) return -1
  if (parsedA.nodeId > parsedB.nodeId) return 1

  return 0
}

/**
 * Check if HLC timestamp a is before b.
 */
export function isHLCBefore(a: HLCString | HLCTimestamp, b: HLCString | HLCTimestamp): boolean {
  return compareHLC(a, b) < 0
}

/**
 * Check if HLC timestamp a is after b.
 */
export function isHLCAfter(a: HLCString | HLCTimestamp, b: HLCString | HLCTimestamp): boolean {
  return compareHLC(a, b) > 0
}

/**
 * Extract the physical time from an HLC timestamp.
 * @param hlc - HLC timestamp (string or parsed)
 * @returns Physical time in milliseconds since Unix epoch
 */
export function getPhysicalTime(hlc: HLCString | HLCTimestamp): number {
  const parsed = typeof hlc === 'string' ? parseHLC(hlc) : hlc
  return parsed.physicalTime
}

/**
 * Convert an HLC timestamp to a JavaScript Date object.
 * Uses the physical time component.
 * @param hlc - HLC timestamp (string or parsed)
 * @returns Date object representing the physical time
 */
export function hlcToDate(hlc: HLCString | HLCTimestamp): Date {
  return new Date(getPhysicalTime(hlc))
}

/**
 * Hybrid Logical Clock class for server-side timestamp generation.
 *
 * Usage:
 * ```typescript
 * const clock = new HLC()
 *
 * // Generate a new timestamp for a server event
 * const ts1 = clock.now()
 *
 * // Update clock when receiving a timestamp from a client
 * const ts2 = clock.receive(clientTimestamp)
 *
 * // Resolve conflicts using last-write-wins
 * const winner = resolveConflict(clientData, serverData, clientHLC, serverHLC)
 * ```
 */
export class HLC {
  private nodeId: string
  private lastPhysicalTime: number
  private lastCounter: number

  /**
   * Create a new HLC instance.
   * @param nodeId - Optional node ID. If not provided, generates a stable server ID.
   */
  constructor(nodeId?: string) {
    this.nodeId = nodeId ?? generateStableServerNodeId()
    this.lastPhysicalTime = 0
    this.lastCounter = 0
  }

  /**
   * Get the node ID for this clock instance.
   */
  getNodeId(): string {
    return this.nodeId
  }

  /**
   * Generate a new HLC timestamp for a local event.
   * The timestamp is guaranteed to be greater than any previously generated
   * or received timestamp.
   *
   * @returns Serialized HLC timestamp string
   */
  now(): HLCString {
    const physicalTime = Date.now()

    if (physicalTime > this.lastPhysicalTime) {
      // Physical time has advanced - reset counter
      this.lastPhysicalTime = physicalTime
      this.lastCounter = 0
    } else {
      // Physical time hasn't advanced - increment counter
      this.lastCounter++

      if (this.lastCounter > MAX_COUNTER) {
        // Counter overflow - advance physical time artificially
        this.lastPhysicalTime++
        this.lastCounter = 0
      }
    }

    return serializeHLC({
      physicalTime: this.lastPhysicalTime,
      counter: this.lastCounter,
      nodeId: this.nodeId,
    })
  }

  /**
   * Update the clock state when receiving a timestamp from a client or another server.
   * This ensures causal ordering is maintained across distributed nodes.
   *
   * @param remoteHLC - The received HLC timestamp (string or parsed)
   * @returns A new HLC timestamp that is greater than both the local clock and the received timestamp
   */
  receive(remoteHLC: HLCString | HLCTimestamp): HLCString {
    const remote = typeof remoteHLC === 'string' ? parseHLC(remoteHLC) : remoteHLC
    const physicalTime = Date.now()

    // Determine the new physical time (max of local, remote, and wall clock)
    const newPhysicalTime = Math.max(physicalTime, this.lastPhysicalTime, remote.physicalTime)

    if (newPhysicalTime === this.lastPhysicalTime && newPhysicalTime === remote.physicalTime) {
      // All three are equal - use max counter + 1
      this.lastCounter = Math.max(this.lastCounter, remote.counter) + 1
    } else if (newPhysicalTime === this.lastPhysicalTime) {
      // Local physical time is max - increment local counter
      this.lastCounter++
    } else if (newPhysicalTime === remote.physicalTime) {
      // Remote physical time is max - use remote counter + 1
      this.lastCounter = remote.counter + 1
    } else {
      // Wall clock is max - reset counter
      this.lastCounter = 0
    }

    this.lastPhysicalTime = newPhysicalTime

    // Handle counter overflow
    if (this.lastCounter > MAX_COUNTER) {
      this.lastPhysicalTime++
      this.lastCounter = 0
    }

    return serializeHLC({
      physicalTime: this.lastPhysicalTime,
      counter: this.lastCounter,
      nodeId: this.nodeId,
    })
  }

  /**
   * Merge with a received timestamp without generating a new event.
   * Updates the internal clock state to ensure future timestamps
   * will be greater than the received one.
   *
   * @param remoteHLC - The received HLC timestamp
   */
  merge(remoteHLC: HLCString | HLCTimestamp): void {
    const remote = typeof remoteHLC === 'string' ? parseHLC(remoteHLC) : remoteHLC

    // Only update if remote is ahead
    if (
      remote.physicalTime > this.lastPhysicalTime ||
      (remote.physicalTime === this.lastPhysicalTime && remote.counter > this.lastCounter)
    ) {
      this.lastPhysicalTime = remote.physicalTime
      this.lastCounter = remote.counter
    }
  }

  /**
   * Get the current clock state without advancing it.
   * @returns The last generated timestamp, or a new one if none exists
   */
  peek(): HLCString {
    if (this.lastPhysicalTime === 0) {
      return this.now()
    }

    return serializeHLC({
      physicalTime: this.lastPhysicalTime,
      counter: this.lastCounter,
      nodeId: this.nodeId,
    })
  }

  /**
   * Reset the clock state. Use with caution - this can break causal ordering.
   */
  reset(): void {
    this.lastPhysicalTime = 0
    this.lastCounter = 0
  }
}

/**
 * Result of conflict resolution
 */
export interface ConflictResolution<T> {
  /** The winning value */
  winner: T
  /** The winning HLC timestamp */
  winningHLC: HLCString
  /** Which side won: 'local', 'remote', or 'equal' */
  source: 'local' | 'remote' | 'equal'
}

/**
 * Last-write-wins conflict resolution helper.
 * Compares two HLC timestamps and returns the data associated with the later one.
 *
 * @param localData - Local/server data
 * @param remoteData - Remote/client data
 * @param localHLC - HLC timestamp for local data
 * @param remoteHLC - HLC timestamp for remote data
 * @returns Conflict resolution result with the winning data
 *
 * @example
 * ```typescript
 * const result = lastWriteWins(
 *   serverRecord,
 *   clientRecord,
 *   serverRecord.hlcTimestamp,
 *   clientRecord.hlcTimestamp
 * )
 *
 * if (result.source === 'remote') {
 *   // Client wins - apply client changes
 *   await updateRecord(result.winner)
 * }
 * ```
 */
export function lastWriteWins<T>(
  localData: T,
  remoteData: T,
  localHLC: HLCString | HLCTimestamp,
  remoteHLC: HLCString | HLCTimestamp,
): ConflictResolution<T> {
  const comparison = compareHLC(localHLC, remoteHLC)

  if (comparison > 0) {
    return {
      winner: localData,
      winningHLC: typeof localHLC === 'string' ? localHLC : serializeHLC(localHLC),
      source: 'local',
    }
  } else if (comparison < 0) {
    return {
      winner: remoteData,
      winningHLC: typeof remoteHLC === 'string' ? remoteHLC : serializeHLC(remoteHLC),
      source: 'remote',
    }
  } else {
    // Timestamps are exactly equal (same node, same time, same counter)
    // This is extremely rare - default to local data
    return {
      winner: localData,
      winningHLC: typeof localHLC === 'string' ? localHLC : serializeHLC(localHLC),
      source: 'equal',
    }
  }
}

/**
 * Field-level conflict resolution using last-write-wins per field.
 * Useful for merging partial updates where different fields may have been
 * modified by different clients.
 *
 * @param localData - Local/server data with HLC timestamps per field
 * @param remoteData - Remote/client data with HLC timestamps per field
 * @param localHLCs - Map of field names to HLC timestamps for local data
 * @param remoteHLCs - Map of field names to HLC timestamps for remote data
 * @returns Merged data with the most recent value for each field
 *
 * @example
 * ```typescript
 * const merged = fieldLevelMerge(
 *   { name: 'Server Name', status: 'active' },
 *   { name: 'Client Name', status: 'inactive' },
 *   { name: '1704067200000:0:server01', status: '1704067100000:0:server01' },
 *   { name: '1704067100000:0:client01', status: '1704067200000:0:client01' }
 * )
 * // Result: { name: 'Server Name', status: 'inactive' }
 * ```
 */
export function fieldLevelMerge<T extends Record<string, unknown>>(
  localData: T,
  remoteData: T,
  localHLCs: Record<keyof T, HLCString>,
  remoteHLCs: Record<keyof T, HLCString>,
): T {
  const result = { ...localData }

  for (const key of Object.keys(remoteData) as Array<keyof T>) {
    const localHLC = localHLCs[key]
    const remoteHLC = remoteHLCs[key]

    if (!localHLC || !remoteHLC) {
      // If either HLC is missing, prefer the one that has it
      if (remoteHLC && !localHLC) {
        result[key] = remoteData[key]
      }
      continue
    }

    const comparison = compareHLC(localHLC, remoteHLC)
    if (comparison < 0) {
      // Remote is newer - use remote value
      result[key] = remoteData[key]
    }
    // If local is newer or equal, keep local value (already in result)
  }

  return result
}

/**
 * Singleton HLC instance for the server.
 * Use this for consistent timestamp generation across the application.
 */
let globalServerClock: HLC | null = null

/**
 * Get or create the global server HLC instance.
 * @returns The global server HLC instance
 */
export function getServerClock(): HLC {
  if (!globalServerClock) {
    globalServerClock = new HLC()
  }
  return globalServerClock
}

/**
 * Generate a new HLC timestamp using the global server clock.
 * @returns Serialized HLC timestamp string
 */
export function serverHlcNow(): HLCString {
  return getServerClock().now()
}

/**
 * Update the global server clock with a received client timestamp.
 * @param remoteHLC - The received HLC timestamp
 * @returns A new HLC timestamp
 */
export function serverHlcReceive(remoteHLC: HLCString | HLCTimestamp): HLCString {
  return getServerClock().receive(remoteHLC)
}

/**
 * Merge a received timestamp into the global server clock.
 * @param remoteHLC - The received HLC timestamp
 */
export function serverHlcMerge(remoteHLC: HLCString | HLCTimestamp): void {
  getServerClock().merge(remoteHLC)
}

/**
 * Validate an HLC string without throwing.
 * @param hlcString - String to validate
 * @returns true if valid, false otherwise
 */
export function isValidHLC(hlcString: string): boolean {
  try {
    parseHLC(hlcString)
    return true
  } catch {
    return false
  }
}

/**
 * Create an HLC timestamp from a Date object.
 * Useful for creating test data or backfilling historical records.
 *
 * @param date - Date to convert
 * @param counter - Optional counter value (default 0)
 * @param nodeId - Optional node ID (default generates random)
 * @returns Serialized HLC string
 */
export function hlcFromDate(date: Date, counter = 0, nodeId?: string): HLCString {
  return serializeHLC({
    physicalTime: date.getTime(),
    counter: Math.min(counter, MAX_COUNTER),
    nodeId: nodeId ?? generateNodeId(),
  })
}

/**
 * Get the minimum (earliest) HLC timestamp from an array.
 * @param timestamps - Array of HLC timestamps
 * @returns The earliest timestamp, or null if array is empty
 */
export function minHLC(timestamps: Array<HLCString | HLCTimestamp>): HLCString | null {
  if (timestamps.length === 0) return null

  let min = timestamps[0]!
  for (let i = 1; i < timestamps.length; i++) {
    if (compareHLC(timestamps[i]!, min) < 0) {
      min = timestamps[i]!
    }
  }

  return typeof min === 'string' ? min : serializeHLC(min)
}

/**
 * Get the maximum (latest) HLC timestamp from an array.
 * @param timestamps - Array of HLC timestamps
 * @returns The latest timestamp, or null if array is empty
 */
export function maxHLC(timestamps: Array<HLCString | HLCTimestamp>): HLCString | null {
  if (timestamps.length === 0) return null

  let max = timestamps[0]!
  for (let i = 1; i < timestamps.length; i++) {
    if (compareHLC(timestamps[i]!, max) > 0) {
      max = timestamps[i]!
    }
  }

  return typeof max === 'string' ? max : serializeHLC(max)
}
