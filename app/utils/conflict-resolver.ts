/**
 * Conflict Resolution Utilities
 * Provides strategies and utilities for resolving sync conflicts between local and server data.
 *
 * Supports:
 * - Multiple resolution strategies (local wins, server wins, merge, manual)
 * - Three-way merge for objects
 * - Field-level conflict detection and tracking
 * - TypeScript types for all structures
 */

/**
 * Types of conflict resolution strategies
 */
export enum ConflictType {
  /** Local version takes precedence */
  LOCAL_WINS = 'local_wins',
  /** Server version takes precedence */
  SERVER_WINS = 'server_wins',
  /** Attempt to merge changes automatically */
  MERGE = 'merge',
  /** Require manual resolution */
  MANUAL = 'manual',
}

/**
 * Represents a conflict at the field level
 */
export interface FieldConflict {
  /** Name of the conflicting field */
  fieldName: string
  /** Value from the base (original) version */
  baseValue: unknown
  /** Value from the local version */
  localValue: unknown
  /** Value from the server version */
  serverValue: unknown
  /** Whether this field has a real conflict (both changed differently) */
  hasConflict: boolean
  /** Source of the resolved value if auto-resolved */
  resolvedFrom?: 'local' | 'server' | 'base' | 'merged'
  /** Resolved value after applying strategy */
  resolvedValue?: unknown
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult<T extends Record<string, unknown>> {
  /** Whether any conflicts were detected */
  hasConflict: boolean
  /** List of conflicting fields */
  conflicts: FieldConflict[]
  /** Fields that changed in local only */
  localOnlyChanges: string[]
  /** Fields that changed in server only */
  serverOnlyChanges: string[]
  /** Fields that changed in both but to the same value */
  sameChanges: string[]
  /** The local data */
  local: T
  /** The server data */
  server: T
  /** The base data (if provided) */
  base?: T
}

/**
 * Result of conflict resolution
 */
export interface ConflictResolutionResult<T extends Record<string, unknown>> {
  /** Whether resolution was successful */
  success: boolean
  /** The resolved/merged data */
  resolved: T
  /** Strategy that was used */
  strategy: ConflictType
  /** Field-level resolution details */
  fieldResolutions: FieldConflict[]
  /** Fields that require manual resolution (if strategy was MANUAL or merge failed) */
  unresolvedFields: string[]
  /** Error message if resolution failed */
  error?: string
}

/**
 * Options for merge resolution
 */
export interface MergeOptions {
  /** Fields that should always prefer local value */
  preferLocalFields?: string[]
  /** Fields that should always prefer server value */
  preferServerFields?: string[]
  /** Custom merge function for specific fields */
  customMergers?: Record<string, (local: unknown, server: unknown, base: unknown) => unknown>
  /** Whether to allow partial merge (resolve what we can, leave conflicts) */
  allowPartialMerge?: boolean
}

/**
 * Deep equality check for two values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>

    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)

    if (aKeys.length !== bKeys.length) return false

    for (const key of aKeys) {
      if (!bKeys.includes(key)) return false
      if (!deepEqual(aObj[key], bObj[key])) return false
    }

    return true
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  return false
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T
  }

  const cloned = {} as T
  for (const key of Object.keys(obj as object)) {
    ;(cloned as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key])
  }
  return cloned
}

/**
 * Detect conflicts between local and server data.
 *
 * @param local - The local version of the data
 * @param server - The server version of the data
 * @param base - Optional base version (the common ancestor) for three-way comparison
 * @returns ConflictDetectionResult with details about conflicts
 *
 * @example
 * ```typescript
 * const result = detectConflict(
 *   { name: 'Local Name', status: 'active' },
 *   { name: 'Server Name', status: 'active' }
 * )
 * if (result.hasConflict) {
 *   console.log('Conflicts found:', result.conflicts)
 * }
 * ```
 */
export function detectConflict<T extends Record<string, unknown>>(
  local: T,
  server: T,
  base?: T,
): ConflictDetectionResult<T> {
  const conflicts: FieldConflict[] = []
  const localOnlyChanges: string[] = []
  const serverOnlyChanges: string[] = []
  const sameChanges: string[] = []

  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(server),
    ...(base ? Object.keys(base) : []),
  ])

  for (const key of allKeys) {
    const localValue = local[key]
    const serverValue = server[key]
    const baseValue = base ? base[key] : undefined

    const localChanged = base ? !deepEqual(localValue, baseValue) : true
    const serverChanged = base ? !deepEqual(serverValue, baseValue) : true
    const valuesMatch = deepEqual(localValue, serverValue)

    if (valuesMatch) {
      // No conflict - values are the same
      if (base && localChanged) {
        // Both changed to the same value
        sameChanges.push(key)
      }
      continue
    }

    if (base) {
      // Three-way comparison with base
      if (localChanged && serverChanged) {
        // Both changed differently - this is a conflict
        conflicts.push({
          fieldName: key,
          baseValue,
          localValue,
          serverValue,
          hasConflict: true,
        })
      } else if (localChanged && !serverChanged) {
        // Only local changed
        localOnlyChanges.push(key)
      } else if (!localChanged && serverChanged) {
        // Only server changed
        serverOnlyChanges.push(key)
      }
    } else {
      // Two-way comparison without base - any difference is a potential conflict
      conflicts.push({
        fieldName: key,
        baseValue: undefined,
        localValue,
        serverValue,
        hasConflict: true,
      })
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    localOnlyChanges,
    serverOnlyChanges,
    sameChanges,
    local,
    server,
    base,
  }
}

/**
 * Resolve a conflict using the specified strategy.
 *
 * @param local - The local version of the data
 * @param server - The server version of the data
 * @param strategy - The resolution strategy to use
 * @param base - Optional base version for three-way merge
 * @param options - Additional options for merge resolution
 * @returns ConflictResolutionResult with the resolved data
 *
 * @example
 * ```typescript
 * // Simple resolution - server wins
 * const result = resolveConflict(localData, serverData, ConflictType.SERVER_WINS)
 *
 * // Three-way merge
 * const result = resolveConflict(localData, serverData, ConflictType.MERGE, baseData)
 *
 * // Merge with custom field preferences
 * const result = resolveConflict(localData, serverData, ConflictType.MERGE, baseData, {
 *   preferLocalFields: ['lastEditedBy'],
 *   preferServerFields: ['version', 'updatedAt']
 * })
 * ```
 */
export function resolveConflict<T extends Record<string, unknown>>(
  local: T,
  server: T,
  strategy: ConflictType,
  base?: T,
  options: MergeOptions = {},
): ConflictResolutionResult<T> {
  const detection = detectConflict(local, server, base)
  const fieldResolutions: FieldConflict[] = []
  const unresolvedFields: string[] = []

  switch (strategy) {
    case ConflictType.LOCAL_WINS: {
      // Local takes precedence for everything
      for (const conflict of detection.conflicts) {
        fieldResolutions.push({
          ...conflict,
          resolvedFrom: 'local',
          resolvedValue: conflict.localValue,
        })
      }
      return {
        success: true,
        resolved: deepClone(local),
        strategy,
        fieldResolutions,
        unresolvedFields: [],
      }
    }

    case ConflictType.SERVER_WINS: {
      // Server takes precedence for everything
      for (const conflict of detection.conflicts) {
        fieldResolutions.push({
          ...conflict,
          resolvedFrom: 'server',
          resolvedValue: conflict.serverValue,
        })
      }
      return {
        success: true,
        resolved: deepClone(server),
        strategy,
        fieldResolutions,
        unresolvedFields: [],
      }
    }

    case ConflictType.MERGE: {
      // Attempt three-way merge
      const result = mergeChanges(base || ({} as T), local, server, options)
      return {
        success: result.unresolvedFields.length === 0,
        resolved: result.merged,
        strategy,
        fieldResolutions: result.fieldResolutions,
        unresolvedFields: result.unresolvedFields,
        error:
          result.unresolvedFields.length > 0
            ? `Unable to auto-merge fields: ${result.unresolvedFields.join(', ')}`
            : undefined,
      }
    }

    case ConflictType.MANUAL: {
      // Don't resolve - return conflicts for manual resolution
      for (const conflict of detection.conflicts) {
        unresolvedFields.push(conflict.fieldName)
        fieldResolutions.push(conflict)
      }
      return {
        success: false,
        resolved: server, // Return server version as base for manual resolution
        strategy,
        fieldResolutions,
        unresolvedFields,
        error: 'Manual resolution required',
      }
    }

    default:
      return {
        success: false,
        resolved: server,
        strategy,
        fieldResolutions: [],
        unresolvedFields: detection.conflicts.map((c) => c.fieldName),
        error: `Unknown strategy: ${strategy}`,
      }
  }
}

/**
 * Merge result type
 */
interface MergeResult<T extends Record<string, unknown>> {
  merged: T
  fieldResolutions: FieldConflict[]
  unresolvedFields: string[]
}

/**
 * Three-way merge for objects.
 * Merges changes from local and server relative to a common base version.
 *
 * @param base - The common ancestor version
 * @param local - The local version with local changes
 * @param server - The server version with server changes
 * @param options - Merge options for field preferences
 * @returns Merged result with field-level details
 *
 * @example
 * ```typescript
 * const base = { name: 'Original', count: 1, status: 'draft' }
 * const local = { name: 'Original', count: 5, status: 'draft' }  // Changed count
 * const server = { name: 'Updated', count: 1, status: 'active' } // Changed name, status
 *
 * const result = mergeChanges(base, local, server)
 * // result.merged = { name: 'Updated', count: 5, status: 'active' }
 * ```
 */
export function mergeChanges<T extends Record<string, unknown>>(
  base: T,
  local: T,
  server: T,
  options: MergeOptions = {},
): MergeResult<T> {
  const {
    preferLocalFields = [],
    preferServerFields = [],
    customMergers = {},
    allowPartialMerge = true,
  } = options

  const merged = deepClone(base)
  const fieldResolutions: FieldConflict[] = []
  const unresolvedFields: string[] = []

  // Get all keys
  const allKeys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)])

  for (const key of allKeys) {
    const baseValue = base[key]
    const localValue = local[key]
    const serverValue = server[key]

    const localChanged = !deepEqual(localValue, baseValue)
    const serverChanged = !deepEqual(serverValue, baseValue)

    // Check for custom merger
    if (customMergers[key]) {
      try {
        const customResult = customMergers[key](localValue, serverValue, baseValue)
        ;(merged as Record<string, unknown>)[key] = customResult
        fieldResolutions.push({
          fieldName: key,
          baseValue,
          localValue,
          serverValue,
          hasConflict: localChanged && serverChanged && !deepEqual(localValue, serverValue),
          resolvedFrom: 'merged',
          resolvedValue: customResult,
        })
        continue
      } catch (err) {
        console.error(`[mergeChanges] Custom merger failed for field ${key}:`, err)
        // Fall through to default handling
      }
    }

    // Check for field preferences
    if (preferLocalFields.includes(key)) {
      ;(merged as Record<string, unknown>)[key] = localValue
      fieldResolutions.push({
        fieldName: key,
        baseValue,
        localValue,
        serverValue,
        hasConflict: false,
        resolvedFrom: 'local',
        resolvedValue: localValue,
      })
      continue
    }

    if (preferServerFields.includes(key)) {
      ;(merged as Record<string, unknown>)[key] = serverValue
      fieldResolutions.push({
        fieldName: key,
        baseValue,
        localValue,
        serverValue,
        hasConflict: false,
        resolvedFrom: 'server',
        resolvedValue: serverValue,
      })
      continue
    }

    // Apply three-way merge logic
    if (!localChanged && !serverChanged) {
      // Neither changed - use base
      ;(merged as Record<string, unknown>)[key] = baseValue
    } else if (localChanged && !serverChanged) {
      // Only local changed - use local
      ;(merged as Record<string, unknown>)[key] = localValue
      fieldResolutions.push({
        fieldName: key,
        baseValue,
        localValue,
        serverValue,
        hasConflict: false,
        resolvedFrom: 'local',
        resolvedValue: localValue,
      })
    } else if (!localChanged && serverChanged) {
      // Only server changed - use server
      ;(merged as Record<string, unknown>)[key] = serverValue
      fieldResolutions.push({
        fieldName: key,
        baseValue,
        localValue,
        serverValue,
        hasConflict: false,
        resolvedFrom: 'server',
        resolvedValue: serverValue,
      })
    } else if (deepEqual(localValue, serverValue)) {
      // Both changed to the same value - no conflict
      ;(merged as Record<string, unknown>)[key] = localValue
      fieldResolutions.push({
        fieldName: key,
        baseValue,
        localValue,
        serverValue,
        hasConflict: false,
        resolvedFrom: 'local', // Could be either, they're the same
        resolvedValue: localValue,
      })
    } else {
      // Both changed differently - true conflict
      if (allowPartialMerge) {
        // Default to server value but mark as conflict
        ;(merged as Record<string, unknown>)[key] = serverValue
        unresolvedFields.push(key)
        fieldResolutions.push({
          fieldName: key,
          baseValue,
          localValue,
          serverValue,
          hasConflict: true,
          resolvedFrom: 'server',
          resolvedValue: serverValue,
        })
      } else {
        unresolvedFields.push(key)
        fieldResolutions.push({
          fieldName: key,
          baseValue,
          localValue,
          serverValue,
          hasConflict: true,
        })
      }
    }
  }

  return {
    merged: merged as T,
    fieldResolutions,
    unresolvedFields,
  }
}

/**
 * Create a field-level conflict tracker for interactive resolution.
 * Useful for building UIs that show conflicts and allow user selection.
 *
 * @param detection - The conflict detection result
 * @returns An object with methods to track and resolve conflicts
 *
 * @example
 * ```typescript
 * const detection = detectConflict(local, server, base)
 * const tracker = createFieldConflictTracker(detection)
 *
 * // In UI, user selects which value to use for each conflict
 * tracker.resolveField('name', 'local')
 * tracker.resolveField('status', 'server')
 *
 * if (tracker.isFullyResolved()) {
 *   const resolved = tracker.getResolvedData()
 * }
 * ```
 */
export function createFieldConflictTracker<T extends Record<string, unknown>>(
  detection: ConflictDetectionResult<T>,
) {
  const resolutions = new Map<string, 'local' | 'server' | unknown>()

  return {
    /**
     * Get all conflicts
     */
    getConflicts: () => detection.conflicts,

    /**
     * Check if a field has been resolved
     */
    isResolved: (fieldName: string): boolean => {
      return resolutions.has(fieldName)
    },

    /**
     * Resolve a field to use local or server value
     */
    resolveField: (fieldName: string, source: 'local' | 'server') => {
      const conflict = detection.conflicts.find((c) => c.fieldName === fieldName)
      if (!conflict) return

      resolutions.set(fieldName, source === 'local' ? conflict.localValue : conflict.serverValue)
    },

    /**
     * Resolve a field with a custom value
     */
    resolveFieldWithValue: (fieldName: string, value: unknown) => {
      resolutions.set(fieldName, value)
    },

    /**
     * Clear resolution for a field
     */
    clearResolution: (fieldName: string) => {
      resolutions.delete(fieldName)
    },

    /**
     * Check if all conflicts are resolved
     */
    isFullyResolved: (): boolean => {
      return detection.conflicts.every((c) => resolutions.has(c.fieldName))
    },

    /**
     * Get the count of unresolved conflicts
     */
    unresolvedCount: (): number => {
      return detection.conflicts.filter((c) => !resolutions.has(c.fieldName)).length
    },

    /**
     * Get the resolved data by merging resolutions with base
     */
    getResolvedData: (): T => {
      // Start with server data as base
      const result = deepClone(detection.server)

      // Apply local-only changes
      for (const fieldName of detection.localOnlyChanges) {
        ;(result as Record<string, unknown>)[fieldName] = detection.local[fieldName]
      }

      // Apply resolutions
      for (const [fieldName, value] of resolutions) {
        ;(result as Record<string, unknown>)[fieldName] = value
      }

      return result
    },

    /**
     * Get summary of resolutions
     */
    getSummary: () => {
      const resolved: string[] = []
      const unresolved: string[] = []

      for (const conflict of detection.conflicts) {
        if (resolutions.has(conflict.fieldName)) {
          resolved.push(conflict.fieldName)
        } else {
          unresolved.push(conflict.fieldName)
        }
      }

      return {
        totalConflicts: detection.conflicts.length,
        resolved,
        unresolved,
        localOnlyChanges: detection.localOnlyChanges,
        serverOnlyChanges: detection.serverOnlyChanges,
      }
    },
  }
}

/**
 * Determine the best automatic resolution strategy based on the conflict type.
 *
 * @param detection - The conflict detection result
 * @param hints - Optional hints to help determine strategy
 * @returns The recommended conflict resolution strategy
 */
export function suggestResolutionStrategy<T extends Record<string, unknown>>(
  detection: ConflictDetectionResult<T>,
  hints?: {
    /** Whether local changes are more recent */
    localIsNewer?: boolean
    /** Whether server data has been validated/approved */
    serverIsAuthoritative?: boolean
    /** Percentage threshold for conflicts (if below, allow auto-merge) */
    autoMergeThreshold?: number
  },
): ConflictType {
  const { localIsNewer, serverIsAuthoritative, autoMergeThreshold = 0.3 } = hints || {}

  // No conflicts - use merge (will auto-apply non-conflicting changes)
  if (!detection.hasConflict) {
    return ConflictType.MERGE
  }

  // Server is authoritative - server wins
  if (serverIsAuthoritative) {
    return ConflictType.SERVER_WINS
  }

  // Local is explicitly newer - local wins
  if (localIsNewer) {
    return ConflictType.LOCAL_WINS
  }

  // Calculate conflict ratio
  const allKeys = new Set([...Object.keys(detection.local), ...Object.keys(detection.server)])
  const conflictRatio = detection.conflicts.length / allKeys.size

  // If conflict ratio is low, suggest merge
  if (conflictRatio <= autoMergeThreshold) {
    return ConflictType.MERGE
  }

  // High conflict ratio - require manual resolution
  return ConflictType.MANUAL
}
