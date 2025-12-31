/**
 * Hybrid Logical Clock (HLC) implementation for client-side offline-first synchronization.
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

/** Maximum value for the 16-bit logical counter */
const MAX_COUNTER = 0xffff

/** Length of node ID in characters */
const NODE_ID_LENGTH = 8

/** Storage key for persisting HLC state */
const HLC_STORAGE_KEY = 'fleet2_hlc_state'

/** Storage key for client node ID */
const NODE_ID_STORAGE_KEY = 'fleet2_hlc_node_id'

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
 * HLC state for persistence
 */
interface HLCState {
  lastPhysicalTime: number
  lastCounter: number
}

/**
 * Generate a random 8-character node ID using base36 encoding.
 * Uses crypto.getRandomValues for cryptographically secure randomness.
 */
export function generateNodeId(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    // Convert to base36 and pad/trim to 8 characters
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return BigInt(`0x${hex}`).toString(36).slice(0, NODE_ID_LENGTH).padStart(NODE_ID_LENGTH, '0')
  }

  // Fallback for environments without crypto
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let nodeId = ''
  for (let i = 0; i < NODE_ID_LENGTH; i++) {
    nodeId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nodeId
}

/**
 * Get or create a persistent node ID for this client instance.
 * The node ID is stored in localStorage and reused across sessions.
 */
export function getOrCreateNodeId(): string {
  if (typeof localStorage === 'undefined') {
    // Server-side or non-browser environment - generate ephemeral ID
    return generateNodeId()
  }

  let nodeId = localStorage.getItem(NODE_ID_STORAGE_KEY)
  if (!nodeId || nodeId.length !== NODE_ID_LENGTH) {
    nodeId = generateNodeId()
    localStorage.setItem(NODE_ID_STORAGE_KEY, nodeId)
  }
  return nodeId
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
 * Hybrid Logical Clock class for generating causally ordered timestamps.
 *
 * Usage:
 * ```typescript
 * const clock = new HLC()
 *
 * // Generate a new timestamp for a local event
 * const ts1 = clock.now()
 *
 * // Update clock when receiving a timestamp from another node
 * const ts2 = clock.receive(remoteTimestamp)
 *
 * // Compare timestamps
 * if (compareHLC(ts1, ts2) < 0) {
 *   console.log('ts1 happened before ts2')
 * }
 * ```
 */
export class HLC {
  private nodeId: string
  private lastPhysicalTime: number
  private lastCounter: number

  /**
   * Create a new HLC instance.
   * @param nodeId - Optional node ID. If not provided, will use persistent ID from localStorage.
   */
  constructor(nodeId?: string) {
    this.nodeId = nodeId ?? getOrCreateNodeId()
    this.lastPhysicalTime = 0
    this.lastCounter = 0

    // Restore state from localStorage if available
    this.restoreState()
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
      // This handles clock drift or multiple events in the same millisecond
      this.lastCounter++

      if (this.lastCounter > MAX_COUNTER) {
        // Counter overflow - advance physical time artificially
        // This is very rare in practice (64k events per ms)
        this.lastPhysicalTime++
        this.lastCounter = 0
      }
    }

    this.persistState()

    return serializeHLC({
      physicalTime: this.lastPhysicalTime,
      counter: this.lastCounter,
      nodeId: this.nodeId,
    })
  }

  /**
   * Update the clock state when receiving a timestamp from another node.
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

    this.persistState()

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
      this.persistState()
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
    this.clearState()
  }

  /**
   * Persist clock state to localStorage.
   */
  private persistState(): void {
    if (typeof localStorage === 'undefined') return

    const state: HLCState = {
      lastPhysicalTime: this.lastPhysicalTime,
      lastCounter: this.lastCounter,
    }

    try {
      localStorage.setItem(HLC_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage may be full or unavailable - continue without persistence
    }
  }

  /**
   * Restore clock state from localStorage.
   */
  private restoreState(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const stored = localStorage.getItem(HLC_STORAGE_KEY)
      if (stored) {
        const state = JSON.parse(stored) as HLCState
        // Only restore if stored state is valid and not in the future
        const now = Date.now()
        if (
          state.lastPhysicalTime > 0 &&
          state.lastPhysicalTime <= now + 60000 && // Allow 1 minute clock drift
          state.lastCounter >= 0 &&
          state.lastCounter <= MAX_COUNTER
        ) {
          this.lastPhysicalTime = state.lastPhysicalTime
          this.lastCounter = state.lastCounter
        }
      }
    } catch {
      // Invalid stored state - start fresh
    }
  }

  /**
   * Clear persisted state from localStorage.
   */
  private clearState(): void {
    if (typeof localStorage === 'undefined') return

    try {
      localStorage.removeItem(HLC_STORAGE_KEY)
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Singleton HLC instance for the client.
 * Use this for consistent timestamp generation across the application.
 */
let globalClock: HLC | null = null

/**
 * Get or create the global HLC instance.
 * @returns The global HLC instance
 */
export function getGlobalClock(): HLC {
  if (!globalClock) {
    globalClock = new HLC()
  }
  return globalClock
}

/**
 * Generate a new HLC timestamp using the global clock.
 * Convenience function for simple use cases.
 * @returns Serialized HLC timestamp string
 */
export function hlcNow(): HLCString {
  return getGlobalClock().now()
}

/**
 * Update the global clock with a received timestamp.
 * Call this when receiving sync data from the server.
 * @param remoteHLC - The received HLC timestamp
 * @returns A new HLC timestamp
 */
export function hlcReceive(remoteHLC: HLCString | HLCTimestamp): HLCString {
  return getGlobalClock().receive(remoteHLC)
}

/**
 * Merge a received timestamp into the global clock.
 * @param remoteHLC - The received HLC timestamp
 */
export function hlcMerge(remoteHLC: HLCString | HLCTimestamp): void {
  getGlobalClock().merge(remoteHLC)
}
