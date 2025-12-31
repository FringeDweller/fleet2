/**
 * Odometer Capture Composable (US-10.6)
 *
 * Provides automatic odometer capture from OBD devices during operator sessions.
 * Falls back to manual entry if OBD is unavailable.
 */

interface OdometerReading {
  value: number
  source: 'obd' | 'manual'
  timestamp: Date
  confidence?: number // 0-1, higher is more confident
}

interface OdometerCaptureState {
  isCapturing: boolean
  lastReading: OdometerReading | null
  error: string | null
}

// OBD-II PIDs for odometer/distance
const OBD_ODOMETER_PIDS = {
  // Standard PIDs
  ODOMETER: '01A6', // PID A6 - Odometer (if supported)
  DISTANCE_MIL_ON: '0121', // Distance traveled with MIL on
  DISTANCE_SINCE_CLEAR: '0131', // Distance since codes cleared
  // These are less accurate but more commonly supported
  RUN_TIME: '011F', // Engine runtime
  FUEL_USED: '014D', // Fuel used
}

export function useOdometerCapture() {
  const toast = useToast()

  // State
  const state = reactive<OdometerCaptureState>({
    isCapturing: false,
    lastReading: null,
    error: null,
  })

  // Check if OBD is available (would be injected by OBD composable)
  const isObdAvailable = computed(() => {
    // Check if we have a connected OBD device
    // This would typically check useBluetoothObd's connection state
    if (!import.meta.client) return false
    // For now, we don't have OBD connection status exposed globally
    // This will be false unless OBD is actively connected
    return false
  })

  /**
   * Attempt to read odometer from OBD device
   * Returns null if not available or not supported
   */
  async function readOdometerFromObd(): Promise<OdometerReading | null> {
    // This would integrate with the actual OBD composable
    // For now, return null as OBD reading is not implemented
    console.log('[OdometerCapture] OBD odometer reading not yet implemented')
    return null
  }

  /**
   * Capture odometer reading
   * First attempts OBD, then falls back to provided manual value
   */
  async function captureOdometer(manualValue?: number): Promise<OdometerReading | null> {
    state.isCapturing = true
    state.error = null

    try {
      // First, try to read from OBD if available
      if (isObdAvailable.value) {
        const obdReading = await readOdometerFromObd()
        if (obdReading) {
          state.lastReading = obdReading
          return obdReading
        }
      }

      // Fall back to manual value if provided
      if (manualValue !== undefined && manualValue !== null) {
        const reading: OdometerReading = {
          value: manualValue,
          source: 'manual',
          timestamp: new Date(),
          confidence: 1.0,
        }
        state.lastReading = reading
        return reading
      }

      // No reading available
      return null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture odometer'
      state.error = message
      console.error('[OdometerCapture] Error:', error)
      return null
    } finally {
      state.isCapturing = false
    }
  }

  /**
   * Capture odometer for session start (log-on)
   */
  async function captureSessionStart(
    _assetId: string,
    manualValue?: number,
  ): Promise<OdometerReading | null> {
    const reading = await captureOdometer(manualValue)

    if (reading && reading.source === 'obd') {
      toast.add({
        title: 'Odometer Captured',
        description: `Odometer reading: ${reading.value.toLocaleString()} km (from OBD)`,
        color: 'success',
        icon: 'i-lucide-gauge',
      })
    }

    return reading
  }

  /**
   * Capture odometer for session end (log-off)
   */
  async function captureSessionEnd(
    _assetId: string,
    manualValue?: number,
    startOdometer?: number,
  ): Promise<{
    reading: OdometerReading | null
    tripDistance: number | null
  }> {
    const reading = await captureOdometer(manualValue)

    let tripDistance: number | null = null

    if (reading && startOdometer !== undefined && startOdometer !== null) {
      tripDistance = reading.value - startOdometer
      if (tripDistance < 0) {
        tripDistance = 0 // Guard against invalid readings
      }
    }

    if (reading && reading.source === 'obd') {
      const distanceMsg = tripDistance !== null ? ` | Trip: ${tripDistance.toFixed(1)} km` : ''
      toast.add({
        title: 'Odometer Captured',
        description: `Odometer reading: ${reading.value.toLocaleString()} km (from OBD)${distanceMsg}`,
        color: 'success',
        icon: 'i-lucide-gauge',
      })
    }

    return { reading, tripDistance }
  }

  /**
   * Update session odometer on the server
   */
  async function updateSessionOdometer(
    sessionId: string,
    type: 'start' | 'end',
    value: number,
    source: 'obd' | 'manual',
  ): Promise<boolean> {
    try {
      await $fetch(`/api/operator-sessions/${sessionId}/odometer`, {
        method: 'PATCH',
        body: {
          type,
          value,
          source,
        },
      })
      return true
    } catch (error) {
      console.error('[OdometerCapture] Failed to update session odometer:', error)
      return false
    }
  }

  /**
   * Validate odometer reading against expected range
   */
  function validateOdometer(
    value: number,
    previousValue?: number,
    maxDailyDistance = 1000,
  ): {
    isValid: boolean
    warning?: string
  } {
    if (value < 0) {
      return { isValid: false, warning: 'Odometer cannot be negative' }
    }

    if (previousValue !== undefined && value < previousValue) {
      return { isValid: false, warning: 'Odometer cannot decrease' }
    }

    if (previousValue !== undefined) {
      const distance = value - previousValue
      if (distance > maxDailyDistance) {
        return {
          isValid: true,
          warning: `Large distance detected (${distance.toFixed(0)} km). Please verify the reading.`,
        }
      }
    }

    return { isValid: true }
  }

  return {
    // State
    isCapturing: computed(() => state.isCapturing),
    lastReading: computed(() => state.lastReading),
    error: computed(() => state.error),
    isObdAvailable,

    // Actions
    captureOdometer,
    captureSessionStart,
    captureSessionEnd,
    updateSessionOdometer,
    validateOdometer,
  }
}
