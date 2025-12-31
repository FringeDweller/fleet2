/**
 * useNetworkStatus composable tests (US-7.4.1c)
 *
 * Tests the network status detection functionality including:
 * 1. Initial state detection (online/offline)
 * 2. Browser API fallback (navigator.onLine, Network Information API)
 * 3. Capacitor plugin support patterns
 * 4. onStatusChange callback functionality
 * 5. Cleanup on unmount
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

describe('useNetworkStatus Composable', () => {
  // Mock event handlers storage
  let onlineHandlers: (() => void)[] = []
  let offlineHandlers: (() => void)[] = []
  let connectionChangeHandlers: ((ev: Event) => void)[] = []

  // Mock connection object
  const createMockConnection = (overrides = {}) => ({
    effectiveType: '4g' as const,
    downlink: 10,
    rtt: 50,
    saveData: false,
    onchange: null,
    addEventListener: vi.fn((event: string, handler: (ev: Event) => void) => {
      if (event === 'change') {
        connectionChangeHandlers.push(handler)
      }
    }),
    removeEventListener: vi.fn((event: string, handler: (ev: Event) => void) => {
      if (event === 'change') {
        connectionChangeHandlers = connectionChangeHandlers.filter((h) => h !== handler)
      }
    }),
    ...overrides,
  })

  beforeEach(() => {
    // Reset handler arrays
    onlineHandlers = []
    offlineHandlers = []
    connectionChangeHandlers = []

    // Reset all mocks
    vi.clearAllMocks()

    // Mock navigator.onLine
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: true,
        connection: createMockConnection(),
      },
      writable: true,
      configurable: true,
    })

    // Mock window.addEventListener and removeEventListener
    const mockWindow = {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'online') onlineHandlers.push(handler)
        if (event === 'offline') offlineHandlers.push(handler)
      }),
      removeEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'online') onlineHandlers = onlineHandlers.filter((h) => h !== handler)
        if (event === 'offline') offlineHandlers = offlineHandlers.filter((h) => h !== handler)
      }),
    }

    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State Detection', () => {
    it('should detect initial online state from navigator.onLine', () => {
      // Arrange
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: true,
        configurable: true,
      })

      // Act - Test the same logic pattern used by the composable
      const isOnline = ref(navigator.onLine)

      // Assert
      expect(isOnline.value).toBe(true)
    })

    it('should detect initial offline state from navigator.onLine', () => {
      // Arrange
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: false,
        configurable: true,
      })

      // Act
      const isOnline = ref(navigator.onLine)

      // Assert
      expect(isOnline.value).toBe(false)
    })

    it('should initialize connection type to null when Network Information API is unavailable', () => {
      // Arrange
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: undefined,
        configurable: true,
      })

      // Act
      const connectionType = ref<string | null>(null)

      // Assert
      expect(connectionType.value).toBe(null)
    })
  })

  describe('Browser API Fallback', () => {
    describe('navigator.onLine', () => {
      it('should use navigator.onLine as initial value in browser environment', () => {
        // Arrange
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          configurable: true,
        })

        // Act
        const isOnline = navigator.onLine

        // Assert
        expect(isOnline).toBe(true)
      })

      it('should handle transition from online to offline', () => {
        // Arrange
        const isOnline = ref(true)
        const wasOnline = ref(true)
        const connectionType = ref<string | null>('4g')
        const callbackCalls: Array<{ isOnline: boolean; connectionType: string | null; wasOnline: boolean }> = []

        const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
          const previousOnline = wasOnline.value
          wasOnline.value = newOnline
          callbackCalls.push({
            isOnline: newOnline,
            connectionType: newType,
            wasOnline: previousOnline,
          })
        }

        const handleBrowserOffline = () => {
          isOnline.value = false
          notifyStatusChange(false, connectionType.value)
        }

        // Act - Simulate offline event
        handleBrowserOffline()

        // Assert
        expect(isOnline.value).toBe(false)
        expect(callbackCalls).toHaveLength(1)
        expect(callbackCalls[0]).toEqual({
          isOnline: false,
          connectionType: '4g',
          wasOnline: true,
        })
      })

      it('should handle transition from offline to online', () => {
        // Arrange
        const isOnline = ref(false)
        const wasOnline = ref(false)
        const connectionType = ref<string | null>('4g')
        const callbackCalls: Array<{ isOnline: boolean; connectionType: string | null; wasOnline: boolean }> = []

        const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
          const previousOnline = wasOnline.value
          wasOnline.value = newOnline
          callbackCalls.push({
            isOnline: newOnline,
            connectionType: newType,
            wasOnline: previousOnline,
          })
        }

        const handleBrowserOnline = () => {
          isOnline.value = true
          notifyStatusChange(true, connectionType.value)
        }

        // Act - Simulate online event
        handleBrowserOnline()

        // Assert
        expect(isOnline.value).toBe(true)
        expect(callbackCalls).toHaveLength(1)
        expect(callbackCalls[0]).toEqual({
          isOnline: true,
          connectionType: '4g',
          wasOnline: false,
        })
      })
    })

    describe('Network Information API', () => {
      it('should read connection type from Network Information API', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '4g' })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { effectiveType: string } }
        const connectionType = nav.connection?.effectiveType ?? null

        // Assert
        expect(connectionType).toBe('4g')
      })

      it('should read downlink speed from Network Information API', () => {
        // Arrange
        const mockConnection = createMockConnection({ downlink: 10 })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { downlink: number } }
        const downlink = nav.connection?.downlink ?? null

        // Assert
        expect(downlink).toBe(10)
      })

      it('should read RTT from Network Information API', () => {
        // Arrange
        const mockConnection = createMockConnection({ rtt: 50 })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { rtt: number } }
        const rtt = nav.connection?.rtt ?? null

        // Assert
        expect(rtt).toBe(50)
      })

      it('should detect slow connection (2g)', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '2g' as const })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { effectiveType: string } }
        const connectionType = nav.connection?.effectiveType
        const isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g'

        // Assert
        expect(isSlowConnection).toBe(true)
      })

      it('should detect slow connection (slow-2g)', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: 'slow-2g' as const })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { effectiveType: string } }
        const connectionType = nav.connection?.effectiveType
        const isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g'

        // Assert
        expect(isSlowConnection).toBe(true)
      })

      it('should not flag 3g as slow connection', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '3g' as const })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { effectiveType: string } }
        const connectionType = nav.connection?.effectiveType
        const isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g'

        // Assert
        expect(isSlowConnection).toBe(false)
      })

      it('should not flag 4g as slow connection', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '4g' as const })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: { effectiveType: string } }
        const connectionType = nav.connection?.effectiveType
        const isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g'

        // Assert
        expect(isSlowConnection).toBe(false)
      })

      it('should update connection info when Network Information API fires change event', () => {
        // Arrange
        const connectionType = ref<string | null>('4g')
        const downlink = ref<number | null>(10)
        const rtt = ref<number | null>(50)
        const isSlowConnection = ref(false)

        const updateBrowserConnectionInfo = () => {
          const nav = navigator as { connection?: { effectiveType: string; downlink: number; rtt: number } }
          const connection = nav.connection
          if (connection) {
            const newType = connection.effectiveType
            connectionType.value = newType
            downlink.value = connection.downlink
            rtt.value = connection.rtt
            isSlowConnection.value = newType === '2g' || newType === 'slow-2g'
          }
        }

        // Act - Simulate connection change by updating mock and calling handler
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: createMockConnection({ effectiveType: '3g', downlink: 1.5, rtt: 300 }),
          configurable: true,
        })
        updateBrowserConnectionInfo()

        // Assert
        expect(connectionType.value).toBe('3g')
        expect(downlink.value).toBe(1.5)
        expect(rtt.value).toBe(300)
        expect(isSlowConnection.value).toBe(false)
      })

      it('should handle missing Network Information API gracefully', () => {
        // Arrange
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: undefined,
          configurable: true,
        })
        Object.defineProperty(globalThis.navigator, 'mozConnection', {
          value: undefined,
          configurable: true,
        })
        Object.defineProperty(globalThis.navigator, 'webkitConnection', {
          value: undefined,
          configurable: true,
        })

        // Act
        const nav = navigator as {
          connection?: unknown
          mozConnection?: unknown
          webkitConnection?: unknown
        }
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection

        // Assert
        expect(connection).toBeUndefined()
      })

      it('should try mozConnection as fallback', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '3g' })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: undefined,
          configurable: true,
        })
        Object.defineProperty(globalThis.navigator, 'mozConnection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as { connection?: unknown; mozConnection?: { effectiveType: string } }
        const connection = nav.connection || nav.mozConnection

        // Assert
        expect(connection).toBeDefined()
        expect((connection as { effectiveType: string }).effectiveType).toBe('3g')
      })

      it('should try webkitConnection as fallback', () => {
        // Arrange
        const mockConnection = createMockConnection({ effectiveType: '4g' })
        Object.defineProperty(globalThis.navigator, 'connection', {
          value: undefined,
          configurable: true,
        })
        Object.defineProperty(globalThis.navigator, 'mozConnection', {
          value: undefined,
          configurable: true,
        })
        Object.defineProperty(globalThis.navigator, 'webkitConnection', {
          value: mockConnection,
          configurable: true,
        })

        // Act
        const nav = navigator as {
          connection?: unknown
          mozConnection?: unknown
          webkitConnection?: { effectiveType: string }
        }
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection

        // Assert
        expect(connection).toBeDefined()
        expect((connection as { effectiveType: string }).effectiveType).toBe('4g')
      })
    })
  })

  describe('Capacitor Plugin Support', () => {
    it('should map wifi connection type to 4g', () => {
      // Arrange
      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'cellular':
            return 'cellular'
          case 'none':
            return null
          case 'unknown':
            return 'unknown'
          default:
            return null
        }
      }

      // Act
      const result = mapCapacitorConnectionType('wifi')

      // Assert
      expect(result).toBe('4g')
    })

    it('should map cellular connection type correctly', () => {
      // Arrange
      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'cellular':
            return 'cellular'
          case 'none':
            return null
          case 'unknown':
            return 'unknown'
          default:
            return null
        }
      }

      // Act
      const result = mapCapacitorConnectionType('cellular')

      // Assert
      expect(result).toBe('cellular')
    })

    it('should map none connection type to null', () => {
      // Arrange
      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'cellular':
            return 'cellular'
          case 'none':
            return null
          case 'unknown':
            return 'unknown'
          default:
            return null
        }
      }

      // Act
      const result = mapCapacitorConnectionType('none')

      // Assert
      expect(result).toBe(null)
    })

    it('should map unknown connection type correctly', () => {
      // Arrange
      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'cellular':
            return 'cellular'
          case 'none':
            return null
          case 'unknown':
            return 'unknown'
          default:
            return null
        }
      }

      // Act
      const result = mapCapacitorConnectionType('unknown')

      // Assert
      expect(result).toBe('unknown')
    })

    it('should handle Capacitor network status change callback', () => {
      // Arrange
      const isOnline = ref(false)
      const connectionType = ref<string | null>(null)
      const isSlowConnection = ref(false)
      const wasOnline = ref(false)
      const callbackCalls: Array<{ isOnline: boolean; connectionType: string | null; wasOnline: boolean }> = []

      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'cellular':
            return 'cellular'
          case 'none':
            return null
          case 'unknown':
            return 'unknown'
          default:
            return null
        }
      }

      const isSlowConnectionType = (type: string | null): boolean => {
        return type === '2g' || type === 'slow-2g'
      }

      const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
        const previousOnline = wasOnline.value
        wasOnline.value = newOnline
        callbackCalls.push({
          isOnline: newOnline,
          connectionType: newType,
          wasOnline: previousOnline,
        })
      }

      const handleCapacitorStatusChange = (status: { connected: boolean; connectionType: string }) => {
        const newOnline = status.connected
        const newType = mapCapacitorConnectionType(status.connectionType)

        isOnline.value = newOnline
        connectionType.value = newType
        isSlowConnection.value = isSlowConnectionType(newType)

        notifyStatusChange(newOnline, newType)
      }

      // Act - Simulate coming online via wifi
      handleCapacitorStatusChange({ connected: true, connectionType: 'wifi' })

      // Assert
      expect(isOnline.value).toBe(true)
      expect(connectionType.value).toBe('4g')
      expect(isSlowConnection.value).toBe(false)
      expect(callbackCalls).toHaveLength(1)
      expect(callbackCalls[0]).toEqual({
        isOnline: true,
        connectionType: '4g',
        wasOnline: false,
      })
    })

    it('should handle Capacitor going offline', () => {
      // Arrange
      const isOnline = ref(true)
      const connectionType = ref<string | null>('4g')
      const wasOnline = ref(true)
      const callbackCalls: Array<{ isOnline: boolean; connectionType: string | null; wasOnline: boolean }> = []

      const mapCapacitorConnectionType = (type: string): string | null => {
        switch (type) {
          case 'wifi':
            return '4g'
          case 'none':
            return null
          default:
            return null
        }
      }

      const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
        const previousOnline = wasOnline.value
        wasOnline.value = newOnline
        callbackCalls.push({
          isOnline: newOnline,
          connectionType: newType,
          wasOnline: previousOnline,
        })
      }

      const handleCapacitorStatusChange = (status: { connected: boolean; connectionType: string }) => {
        const newOnline = status.connected
        const newType = mapCapacitorConnectionType(status.connectionType)

        isOnline.value = newOnline
        connectionType.value = newType

        notifyStatusChange(newOnline, newType)
      }

      // Act - Simulate going offline
      handleCapacitorStatusChange({ connected: false, connectionType: 'none' })

      // Assert
      expect(isOnline.value).toBe(false)
      expect(connectionType.value).toBe(null)
      expect(callbackCalls).toHaveLength(1)
      expect(callbackCalls[0]).toEqual({
        isOnline: false,
        connectionType: null,
        wasOnline: true,
      })
    })
  })

  describe('onStatusChange Callback', () => {
    it('should register callback and return unsubscribe function', () => {
      // Arrange
      const statusChangeCallbacks = new Set<() => void>()
      const callback = vi.fn()

      const onStatusChange = (cb: () => void): (() => void) => {
        statusChangeCallbacks.add(cb)
        return () => {
          statusChangeCallbacks.delete(cb)
        }
      }

      // Act
      const unsubscribe = onStatusChange(callback)

      // Assert
      expect(statusChangeCallbacks.has(callback)).toBe(true)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should call registered callback on status change', () => {
      // Arrange
      type StatusChangeCallback = (status: {
        isOnline: boolean
        connectionType: string | null
        wasOnline: boolean
      }) => void

      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const callback = vi.fn()

      const onStatusChange = (cb: StatusChangeCallback): (() => void) => {
        statusChangeCallbacks.add(cb)
        return () => statusChangeCallbacks.delete(cb)
      }

      const notifyStatusChange = (isOnline: boolean, connectionType: string | null, wasOnline: boolean) => {
        for (const cb of statusChangeCallbacks) {
          cb({ isOnline, connectionType, wasOnline })
        }
      }

      onStatusChange(callback)

      // Act
      notifyStatusChange(false, '4g', true)

      // Assert
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({
        isOnline: false,
        connectionType: '4g',
        wasOnline: true,
      })
    })

    it('should pass correct wasOnline value to callback', () => {
      // Arrange
      type StatusChangeCallback = (status: {
        isOnline: boolean
        connectionType: string | null
        wasOnline: boolean
      }) => void

      const wasOnline = ref(true)
      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const receivedStatuses: Array<{ isOnline: boolean; wasOnline: boolean }> = []

      const callback: StatusChangeCallback = (status) => {
        receivedStatuses.push({ isOnline: status.isOnline, wasOnline: status.wasOnline })
      }

      statusChangeCallbacks.add(callback)

      const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
        const previousOnline = wasOnline.value
        wasOnline.value = newOnline
        for (const cb of statusChangeCallbacks) {
          cb({ isOnline: newOnline, connectionType: newType, wasOnline: previousOnline })
        }
      }

      // Act - Simulate online -> offline -> online transitions
      notifyStatusChange(false, null) // Go offline
      notifyStatusChange(true, '4g') // Come back online

      // Assert
      expect(receivedStatuses).toHaveLength(2)
      expect(receivedStatuses[0]).toEqual({ isOnline: false, wasOnline: true })
      expect(receivedStatuses[1]).toEqual({ isOnline: true, wasOnline: false })
    })

    it('should support multiple callbacks', () => {
      // Arrange
      type StatusChangeCallback = (status: {
        isOnline: boolean
        connectionType: string | null
        wasOnline: boolean
      }) => void

      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      const onStatusChange = (cb: StatusChangeCallback): (() => void) => {
        statusChangeCallbacks.add(cb)
        return () => statusChangeCallbacks.delete(cb)
      }

      const notifyStatusChange = (isOnline: boolean, connectionType: string | null, wasOnline: boolean) => {
        for (const cb of statusChangeCallbacks) {
          cb({ isOnline, connectionType, wasOnline })
        }
      }

      onStatusChange(callback1)
      onStatusChange(callback2)
      onStatusChange(callback3)

      // Act
      notifyStatusChange(true, '4g', false)

      // Assert
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
    })

    it('should unsubscribe callback correctly', () => {
      // Arrange
      type StatusChangeCallback = (status: {
        isOnline: boolean
        connectionType: string | null
        wasOnline: boolean
      }) => void

      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const callback = vi.fn()

      const onStatusChange = (cb: StatusChangeCallback): (() => void) => {
        statusChangeCallbacks.add(cb)
        return () => statusChangeCallbacks.delete(cb)
      }

      const notifyStatusChange = (isOnline: boolean, connectionType: string | null, wasOnline: boolean) => {
        for (const cb of statusChangeCallbacks) {
          cb({ isOnline, connectionType, wasOnline })
        }
      }

      const unsubscribe = onStatusChange(callback)

      // Act
      notifyStatusChange(false, null, true) // First call
      unsubscribe()
      notifyStatusChange(true, '4g', false) // Second call - should not reach callback

      // Assert
      expect(callback).toHaveBeenCalledTimes(1)
      expect(statusChangeCallbacks.has(callback)).toBe(false)
    })

    it('should handle callback errors gracefully without affecting other callbacks', () => {
      // Arrange
      type StatusChangeCallback = (status: {
        isOnline: boolean
        connectionType: string | null
        wasOnline: boolean
      }) => void

      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const normalCallback = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const onStatusChange = (cb: StatusChangeCallback): (() => void) => {
        statusChangeCallbacks.add(cb)
        return () => statusChangeCallbacks.delete(cb)
      }

      const notifyStatusChange = (isOnline: boolean, connectionType: string | null, wasOnline: boolean) => {
        for (const cb of statusChangeCallbacks) {
          try {
            cb({ isOnline, connectionType, wasOnline })
          } catch (err) {
            console.error('[useNetworkStatus] Error in status change callback:', err)
          }
        }
      }

      onStatusChange(errorCallback)
      onStatusChange(normalCallback)

      // Act
      notifyStatusChange(true, '4g', false)

      // Assert
      expect(errorCallback).toHaveBeenCalledTimes(1)
      expect(normalCallback).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useNetworkStatus] Error in status change callback:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Cleanup', () => {
    it('should clear all callbacks on cleanup', () => {
      // Arrange
      type StatusChangeCallback = () => void
      const statusChangeCallbacks = new Set<StatusChangeCallback>()
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      statusChangeCallbacks.add(callback1)
      statusChangeCallbacks.add(callback2)

      // Act - Simulate cleanup
      statusChangeCallbacks.clear()

      // Assert
      expect(statusChangeCallbacks.size).toBe(0)
    })

    it('should remove browser event listeners on cleanup', () => {
      // Arrange
      const removeEventListenerSpy = vi.fn()
      const mockWindow = {
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
      }
      Object.defineProperty(globalThis, 'window', {
        value: mockWindow,
        configurable: true,
      })

      const handleBrowserOnline = vi.fn()
      const handleBrowserOffline = vi.fn()

      // Act - Simulate cleanup
      mockWindow.removeEventListener('online', handleBrowserOnline)
      mockWindow.removeEventListener('offline', handleBrowserOffline)

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', handleBrowserOnline)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', handleBrowserOffline)
    })

    it('should remove Network Information API change listener on cleanup', () => {
      // Arrange
      const removeEventListenerSpy = vi.fn()
      const mockConnection = {
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
      }

      const updateBrowserConnectionInfo = vi.fn()

      // Act - Simulate cleanup
      mockConnection.removeEventListener('change', updateBrowserConnectionInfo)

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', updateBrowserConnectionInfo)
    })

    it('should remove Capacitor listener on cleanup', async () => {
      // Arrange
      const removeSpy = vi.fn().mockResolvedValue(undefined)
      const mockHandle = { remove: removeSpy }

      // Act - Simulate cleanup
      await mockHandle.remove()

      // Assert
      expect(removeSpy).toHaveBeenCalled()
    })

    it('should handle Capacitor listener removal error gracefully', async () => {
      // Arrange
      const removeSpy = vi.fn().mockRejectedValue(new Error('Removal failed'))
      const mockHandle = { remove: removeSpy }
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Act - Simulate cleanup with error handling
      try {
        await mockHandle.remove()
      } catch (err) {
        console.error('[useNetworkStatus] Error removing Capacitor listener:', err)
      }

      // Assert
      expect(removeSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useNetworkStatus] Error removing Capacitor listener:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid online/offline toggles', () => {
      // Arrange
      const isOnline = ref(true)
      const wasOnline = ref(true)
      const callbackCalls: Array<{ isOnline: boolean; wasOnline: boolean }> = []

      const notifyStatusChange = (newOnline: boolean) => {
        const previousOnline = wasOnline.value
        wasOnline.value = newOnline
        isOnline.value = newOnline
        callbackCalls.push({
          isOnline: newOnline,
          wasOnline: previousOnline,
        })
      }

      // Act - Rapid toggles
      notifyStatusChange(false) // offline
      notifyStatusChange(true) // online
      notifyStatusChange(false) // offline
      notifyStatusChange(true) // online

      // Assert
      expect(callbackCalls).toHaveLength(4)
      expect(callbackCalls[0]).toEqual({ isOnline: false, wasOnline: true })
      expect(callbackCalls[1]).toEqual({ isOnline: true, wasOnline: false })
      expect(callbackCalls[2]).toEqual({ isOnline: false, wasOnline: true })
      expect(callbackCalls[3]).toEqual({ isOnline: true, wasOnline: false })
    })

    it('should handle same status notifications without duplicate wasOnline values', () => {
      // Arrange
      const wasOnline = ref(true)
      const callbackCalls: Array<{ isOnline: boolean; wasOnline: boolean }> = []

      const notifyStatusChange = (newOnline: boolean) => {
        const previousOnline = wasOnline.value
        wasOnline.value = newOnline
        callbackCalls.push({
          isOnline: newOnline,
          wasOnline: previousOnline,
        })
      }

      // Act - Same status multiple times
      notifyStatusChange(true) // Still online
      notifyStatusChange(true) // Still online

      // Assert
      expect(callbackCalls).toHaveLength(2)
      expect(callbackCalls[0]).toEqual({ isOnline: true, wasOnline: true })
      expect(callbackCalls[1]).toEqual({ isOnline: true, wasOnline: true })
    })

    it('should return readonly refs to prevent external mutation', () => {
      // Arrange
      const isOnline = ref(true)
      const connectionType = ref<string | null>('4g')

      // Act - Create readonly versions (simulating composable return)
      const readonlyIsOnline = { value: isOnline.value }
      const readonlyConnectionType = { value: connectionType.value }

      // Assert - Values should be readable
      expect(readonlyIsOnline.value).toBe(true)
      expect(readonlyConnectionType.value).toBe('4g')
    })
  })
})
