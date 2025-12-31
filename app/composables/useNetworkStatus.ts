/**
 * Network Status Composable (US-7.3, US-7.4.1a)
 * Provides reactive network status detection using Capacitor Network plugin
 * when running in a native app, falling back to browser APIs for web.
 */

import { Capacitor } from '@capacitor/core'
import { type ConnectionStatus, type ConnectionType, Network } from '@capacitor/network'

export interface NetworkStatus {
  /** Whether the device reports being online */
  isOnline: Readonly<Ref<boolean>>
  /** Whether the network connection type is known */
  connectionType: Readonly<Ref<string | null>>
  /** Whether the connection is considered slow (e.g., 2G) */
  isSlowConnection: Readonly<Ref<boolean>>
  /** Downlink speed in Mbps (if available, browser only) */
  downlink: Readonly<Ref<number | null>>
  /** Round-trip time in ms (if available, browser only) */
  rtt: Readonly<Ref<number | null>>
  /** Whether running on Capacitor native platform */
  isCapacitor: Readonly<Ref<boolean>>
  /** Register a callback for network status changes */
  onStatusChange: (callback: NetworkStatusChangeCallback) => () => void
}

/** Callback type for network status changes */
export type NetworkStatusChangeCallback = (status: {
  isOnline: boolean
  connectionType: string | null
  wasOnline: boolean
}) => void

// Extended Navigator interface for Network Information API
interface NetworkInformation extends EventTarget {
  readonly effectiveType: '2g' | '3g' | '4g' | 'slow-2g'
  readonly downlink: number
  readonly rtt: number
  readonly saveData: boolean
  onchange: ((this: NetworkInformation, ev: Event) => void) | null
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
  mozConnection?: NetworkInformation
  webkitConnection?: NetworkInformation
}

// Capacitor connection type to string mapping
function mapCapacitorConnectionType(type: ConnectionType): string | null {
  switch (type) {
    case 'wifi':
      return '4g' // WiFi is generally fast
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

// Check if a connection type is considered slow
function isSlowConnectionType(type: string | null): boolean {
  return type === '2g' || type === 'slow-2g'
}

export function useNetworkStatus(): NetworkStatus {
  // Detect if running in Capacitor
  const isCapacitor = ref(false)
  const isPluginAvailable = ref(false)

  // Core state
  const isOnline = ref(true)
  const connectionType = ref<string | null>(null)
  const isSlowConnection = ref(false)
  const downlink = ref<number | null>(null)
  const rtt = ref<number | null>(null)

  // Store the previous online state for change detection
  const wasOnline = ref(true)

  // Callbacks registry for status change notifications
  const statusChangeCallbacks = new Set<NetworkStatusChangeCallback>()

  // Notify all registered callbacks
  const notifyStatusChange = (newOnline: boolean, newType: string | null) => {
    const previousOnline = wasOnline.value
    wasOnline.value = newOnline

    for (const callback of statusChangeCallbacks) {
      try {
        callback({
          isOnline: newOnline,
          connectionType: newType,
          wasOnline: previousOnline,
        })
      } catch (err) {
        console.error('[useNetworkStatus] Error in status change callback:', err)
      }
    }
  }

  // Register a callback for status changes
  const onStatusChange = (callback: NetworkStatusChangeCallback): (() => void) => {
    statusChangeCallbacks.add(callback)
    return () => {
      statusChangeCallbacks.delete(callback)
    }
  }

  // Get the Browser Network Information API connection object
  const getBrowserConnection = (): NetworkInformation | undefined => {
    if (!import.meta.client) return undefined
    const nav = navigator as NavigatorWithConnection
    return nav.connection || nav.mozConnection || nav.webkitConnection
  }

  // Update connection info from Browser API
  const updateBrowserConnectionInfo = () => {
    const connection = getBrowserConnection()
    if (connection) {
      const newType = connection.effectiveType
      connectionType.value = newType
      downlink.value = connection.downlink
      rtt.value = connection.rtt
      isSlowConnection.value = isSlowConnectionType(newType)
    }
  }

  // Handle browser online/offline events
  const handleBrowserOnline = () => {
    isOnline.value = true
    updateBrowserConnectionInfo()
    notifyStatusChange(true, connectionType.value)
  }

  const handleBrowserOffline = () => {
    isOnline.value = false
    notifyStatusChange(false, connectionType.value)
  }

  // Handle Capacitor network status change
  const handleCapacitorStatusChange = (status: ConnectionStatus) => {
    const newOnline = status.connected
    const newType = mapCapacitorConnectionType(status.connectionType)

    isOnline.value = newOnline
    connectionType.value = newType
    isSlowConnection.value = isSlowConnectionType(newType)

    notifyStatusChange(newOnline, newType)
  }

  // Listener handle for cleanup
  let capacitorListenerHandle: { remove: () => Promise<void> } | null = null

  // Set up listeners on client side
  if (import.meta.client) {
    // Check for Capacitor
    isCapacitor.value = Capacitor.isNativePlatform()
    isPluginAvailable.value = Capacitor.isPluginAvailable('Network')

    if (isCapacitor.value && isPluginAvailable.value) {
      // Use Capacitor Network plugin
      // Get initial status
      Network.getStatus()
        .then((status) => {
          isOnline.value = status.connected
          connectionType.value = mapCapacitorConnectionType(status.connectionType)
          isSlowConnection.value = isSlowConnectionType(connectionType.value)
          wasOnline.value = status.connected
        })
        .catch((err) => {
          console.error('[useNetworkStatus] Error getting Capacitor network status:', err)
          // Fallback to browser online status
          isOnline.value = navigator.onLine
          wasOnline.value = navigator.onLine
        })

      // Listen for network status changes
      Network.addListener('networkStatusChange', handleCapacitorStatusChange)
        .then((handle) => {
          capacitorListenerHandle = handle
        })
        .catch((err) => {
          console.error('[useNetworkStatus] Error adding Capacitor network listener:', err)
        })
    } else {
      // Use Browser APIs
      // Initial state from navigator.onLine
      isOnline.value = navigator.onLine
      wasOnline.value = navigator.onLine

      // Initial update of connection info
      updateBrowserConnectionInfo()

      // Listen for online/offline events
      window.addEventListener('online', handleBrowserOnline)
      window.addEventListener('offline', handleBrowserOffline)

      // Listen for connection changes (Network Information API)
      const connection = getBrowserConnection()
      if (connection) {
        connection.addEventListener('change', updateBrowserConnectionInfo)
      }
    }

    // Clean up on unmount
    onUnmounted(() => {
      // Clear callbacks
      statusChangeCallbacks.clear()

      if (isCapacitor.value && capacitorListenerHandle) {
        // Remove Capacitor listener
        capacitorListenerHandle.remove().catch((err) => {
          console.error('[useNetworkStatus] Error removing Capacitor listener:', err)
        })
      } else {
        // Remove browser event listeners
        window.removeEventListener('online', handleBrowserOnline)
        window.removeEventListener('offline', handleBrowserOffline)

        const conn = getBrowserConnection()
        if (conn) {
          conn.removeEventListener('change', updateBrowserConnectionInfo)
        }
      }
    })
  }

  return {
    isOnline: readonly(isOnline),
    connectionType: readonly(connectionType),
    isSlowConnection: readonly(isSlowConnection),
    downlink: readonly(downlink),
    rtt: readonly(rtt),
    isCapacitor: readonly(isCapacitor),
    onStatusChange,
  }
}

/**
 * Composable that provides a toast notification when network status changes.
 * Works with both Capacitor (native) and browser environments.
 */
export function useNetworkStatusNotifications() {
  const networkStatus = useNetworkStatus()
  const { isOnline, isCapacitor, onStatusChange } = networkStatus
  const toast = useToast()

  // Use the onStatusChange callback for reliable change detection
  if (import.meta.client) {
    const unsubscribe = onStatusChange(({ isOnline: online, wasOnline }) => {
      if (online && !wasOnline) {
        // Just came online
        toast.add({
          title: 'Back online',
          description:
            'Your connection has been restored. Pending changes will sync automatically.',
          color: 'success',
          icon: 'i-lucide-wifi',
        })
      } else if (!online && wasOnline) {
        // Just went offline
        toast.add({
          title: 'You are offline',
          description: 'Changes will be saved locally and synced when you are back online.',
          color: 'warning',
          icon: 'i-lucide-wifi-off',
        })
      }
    })

    // Clean up on unmount
    onUnmounted(() => {
      unsubscribe()
    })
  }

  return {
    isOnline,
    isCapacitor,
  }
}
