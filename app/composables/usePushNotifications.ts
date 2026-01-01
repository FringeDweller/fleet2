/**
 * Push Notifications Composable
 *
 * Provides reactive state and methods for managing push notifications:
 * - Check if push notifications are supported
 * - Request notification permission
 * - Get/refresh FCM token
 * - Register token with backend
 * - Handle foreground messages
 *
 * Works with Firebase Cloud Messaging (FCM) for web and native platforms.
 */

import type { MessagePayload } from 'firebase/messaging'

/** Permission states for push notifications */
export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

/** Platform type for push token registration */
export type PushPlatform = 'web' | 'ios' | 'android'

/** Push notification state exposed by the composable */
export interface PushNotificationState {
  /** Whether push notifications are supported in this browser/environment */
  isSupported: Readonly<Ref<boolean>>
  /** Current permission state */
  permissionState: Readonly<Ref<PushPermissionState>>
  /** Current FCM token (null if not registered) */
  token: Readonly<Ref<string | null>>
  /** Whether initialization is in progress */
  isInitializing: Readonly<Ref<boolean>>
  /** Whether a permission request is in progress */
  isRequestingPermission: Readonly<Ref<boolean>>
  /** Last error message if any operation failed */
  lastError: Readonly<Ref<string | null>>
  /** Whether the token has been registered with the backend */
  isRegistered: Readonly<Ref<boolean>>
}

/** Foreground message handler callback */
export type ForegroundMessageCallback = (payload: MessagePayload) => void

/** Options for the push notifications composable */
export interface UsePushNotificationsOptions {
  /** Whether to automatically request permission on init (default: false) */
  autoRequestPermission?: boolean
  /** Whether to automatically register token on init (default: true) */
  autoRegisterToken?: boolean
  /** Callback for foreground messages */
  onForegroundMessage?: ForegroundMessageCallback
}

const DEFAULT_OPTIONS: Required<Omit<UsePushNotificationsOptions, 'onForegroundMessage'>> & {
  onForegroundMessage?: ForegroundMessageCallback
} = {
  autoRequestPermission: false,
  autoRegisterToken: true,
  onForegroundMessage: undefined,
}

// Singleton state for Firebase Messaging instance
let messagingInstance: Awaited<
  ReturnType<typeof import('firebase/messaging').getMessaging>
> | null = null
let firebaseApp: ReturnType<typeof import('firebase/app').initializeApp> | undefined
let unsubscribeForeground: (() => void) | null = null

/**
 * Detect the current platform
 */
function detectPlatform(): PushPlatform {
  if (typeof window === 'undefined') return 'web'

  const userAgent = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios'
  if (/android/.test(userAgent)) return 'android'
  return 'web'
}

/**
 * Get device ID for token registration
 * Uses a persistent ID stored in localStorage
 */
function getDeviceId(): string {
  const storageKey = 'fleet2_device_id'
  let deviceId = localStorage.getItem(storageKey)

  if (!deviceId) {
    // Generate a unique device ID
    deviceId = `${detectPlatform()}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem(storageKey, deviceId)
  }

  return deviceId
}

/** Device info object for registration */
interface DeviceInfo {
  model?: string
  osVersion?: string
  appVersion?: string
  manufacturer?: string
}

/**
 * Get device info for registration
 * Returns an object matching the API schema
 */
function getDeviceInfo(): DeviceInfo | undefined {
  if (typeof window === 'undefined') return undefined

  // Extract OS and version from user agent
  const userAgent = navigator.userAgent
  let osVersion: string | undefined
  let model: string | undefined

  // Try to extract OS version
  const iosMatch = userAgent.match(/OS (\d+_\d+(?:_\d+)?)/i)
  const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)*)/i)
  const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/i)
  const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/i)

  if (iosMatch?.[1]) {
    osVersion = `iOS ${iosMatch[1].replace(/_/g, '.')}`
  } else if (androidMatch?.[1]) {
    osVersion = `Android ${androidMatch[1]}`
  } else if (windowsMatch?.[1]) {
    osVersion = `Windows ${windowsMatch[1]}`
  } else if (macMatch?.[1]) {
    osVersion = `macOS ${macMatch[1].replace(/_/g, '.')}`
  }

  // Try to extract device model (limited on web)
  const mobileMatch = userAgent.match(/\(([^)]+)\)/i)
  if (mobileMatch?.[1]) {
    model = mobileMatch[1].split(';')[0]?.trim()
  }

  return {
    model,
    osVersion,
    appVersion: '1.0.0', // Could be from runtime config
  }
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {},
): PushNotificationState & {
  /** Initialize Firebase and check current state */
  initialize: () => Promise<void>
  /** Request notification permission from the user */
  requestPermission: () => Promise<boolean>
  /** Get or refresh the FCM token */
  getToken: () => Promise<string | null>
  /** Register the token with the backend */
  registerToken: (token?: string) => Promise<boolean>
  /** Unregister the current token (e.g., on logout) */
  unregisterToken: () => Promise<boolean>
  /** Register a handler for foreground messages */
  onMessage: (callback: ForegroundMessageCallback) => () => void
} {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const runtimeConfig = useRuntimeConfig()
  const toast = useToast()

  // Core state
  const isSupported = ref(false)
  const permissionState = ref<PushPermissionState>('unsupported')
  const token = ref<string | null>(null)
  const isInitializing = ref(false)
  const isRequestingPermission = ref(false)
  const lastError = ref<string | null>(null)
  const isRegistered = ref(false)

  // Message callbacks
  const messageCallbacks = new Set<ForegroundMessageCallback>()

  /**
   * Check if push notifications are supported
   */
  const checkSupport = (): boolean => {
    if (typeof window === 'undefined') return false
    if (!('Notification' in window)) return false
    if (!('serviceWorker' in navigator)) return false
    if (!('PushManager' in window)) return false
    return true
  }

  /**
   * Get current permission state
   */
  const getPermissionState = (): PushPermissionState => {
    if (!checkSupport()) return 'unsupported'
    const permission = Notification.permission
    if (permission === 'granted') return 'granted'
    if (permission === 'denied') return 'denied'
    return 'prompt'
  }

  /**
   * Initialize Firebase Messaging
   */
  const initializeFirebase = async () => {
    if (firebaseApp !== undefined && messagingInstance) return messagingInstance

    // Get Firebase config from runtime config
    const firebaseConfig = {
      apiKey: runtimeConfig.public.firebaseApiKey,
      authDomain: runtimeConfig.public.firebaseAuthDomain,
      projectId: runtimeConfig.public.firebaseProjectId,
      messagingSenderId: runtimeConfig.public.firebaseMessagingSenderId,
      appId: runtimeConfig.public.firebaseAppId,
    }

    // Check if config is available
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error('Firebase configuration is not available in runtime config')
    }

    // Dynamically import Firebase
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, isSupported: isMessagingSupported } = await import('firebase/messaging')

    // Check if messaging is supported
    const supported = await isMessagingSupported()
    if (!supported) {
      throw new Error('Firebase Messaging is not supported in this browser')
    }

    // Initialize app if not already done
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig)
    } else {
      firebaseApp = getApps()[0]
    }

    // Get messaging instance
    messagingInstance = getMessaging(firebaseApp)
    return messagingInstance
  }

  /**
   * Initialize the composable
   */
  const initialize = async () => {
    if (!import.meta.client) return
    if (isInitializing.value) return

    isInitializing.value = true
    lastError.value = null

    try {
      // Check browser support
      isSupported.value = checkSupport()
      permissionState.value = getPermissionState()

      if (!isSupported.value) {
        console.debug('[usePushNotifications] Push notifications not supported')
        return
      }

      // Initialize Firebase
      await initializeFirebase()

      // If permission already granted, get token
      if (permissionState.value === 'granted') {
        const fcmToken = await getToken()

        // Auto-register if configured
        if (fcmToken && config.autoRegisterToken) {
          await registerToken(fcmToken)
        }
      } else if (config.autoRequestPermission) {
        // Auto-request permission if configured
        await requestPermission()
      }

      // Set up foreground message handler
      setupForegroundHandler()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError.value = error.message
      console.error('[usePushNotifications] Initialization failed:', error)
    } finally {
      isInitializing.value = false
    }
  }

  /**
   * Set up handler for foreground messages
   */
  const setupForegroundHandler = async () => {
    if (!messagingInstance) return
    if (unsubscribeForeground) return // Already set up

    const { onMessage: onFcmMessage } = await import('firebase/messaging')

    unsubscribeForeground = onFcmMessage(messagingInstance, (payload) => {
      console.debug('[usePushNotifications] Foreground message received:', payload)

      // Notify all registered callbacks
      for (const callback of messageCallbacks) {
        try {
          callback(payload)
        } catch (err) {
          console.error('[usePushNotifications] Error in message callback:', err)
        }
      }

      // Call the options callback if provided
      if (config.onForegroundMessage) {
        config.onForegroundMessage(payload)
      }

      // Show toast notification for foreground messages
      if (payload.notification) {
        toast.add({
          title: payload.notification.title || 'New Notification',
          description: payload.notification.body || '',
          color: 'info',
          icon: 'i-lucide-bell',
        })
      }
    })
  }

  /**
   * Request notification permission
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!import.meta.client) return false
    if (!isSupported.value) return false
    if (isRequestingPermission.value) return permissionState.value === 'granted'

    isRequestingPermission.value = true
    lastError.value = null

    try {
      const result = await Notification.requestPermission()
      permissionState.value =
        result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt'

      if (result === 'granted') {
        // Initialize Firebase if not done
        await initializeFirebase()

        // Get and register token
        const fcmToken = await getToken()
        if (fcmToken && config.autoRegisterToken) {
          await registerToken(fcmToken)
        }

        return true
      }

      return false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError.value = error.message
      console.error('[usePushNotifications] Permission request failed:', error)
      return false
    } finally {
      isRequestingPermission.value = false
    }
  }

  /**
   * Get or refresh FCM token
   */
  const getToken = async (): Promise<string | null> => {
    if (!import.meta.client) return null
    if (!isSupported.value) return null
    if (permissionState.value !== 'granted') return null

    lastError.value = null

    try {
      // Ensure Firebase is initialized
      const messaging = await initializeFirebase()
      if (!messaging) return null

      const { getToken: getFcmToken } = await import('firebase/messaging')

      // Get VAPID key from runtime config
      const vapidKey = runtimeConfig.public.firebaseVapidKey

      // Get token with VAPID key
      const fcmToken = await getFcmToken(messaging, {
        vapidKey: vapidKey || undefined,
      })

      if (fcmToken) {
        token.value = fcmToken
        return fcmToken
      }

      return null
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError.value = error.message
      console.error('[usePushNotifications] Failed to get token:', error)
      return null
    }
  }

  /**
   * Register token with backend
   */
  const registerToken = async (fcmToken?: string): Promise<boolean> => {
    if (!import.meta.client) return false

    const tokenToRegister = fcmToken || token.value
    if (!tokenToRegister) {
      lastError.value = 'No token available to register'
      return false
    }

    lastError.value = null

    try {
      const response = await $fetch('/api/notifications/register', {
        method: 'POST',
        body: {
          deviceToken: tokenToRegister,
          platform: detectPlatform(),
          deviceId: getDeviceId(),
          deviceInfo: getDeviceInfo(),
        },
      })

      if (response) {
        isRegistered.value = true
        console.debug('[usePushNotifications] Token registered successfully')
        return true
      }

      return false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError.value = error.message
      console.error('[usePushNotifications] Failed to register token:', error)
      return false
    }
  }

  /**
   * Unregister current token (e.g., on logout)
   */
  const unregisterToken = async (): Promise<boolean> => {
    if (!import.meta.client) return false
    if (!token.value) return true // Already unregistered

    lastError.value = null

    try {
      await $fetch('/api/notifications/unregister', {
        method: 'POST',
        body: {
          deviceToken: token.value,
        },
      })

      token.value = null
      isRegistered.value = false
      console.debug('[usePushNotifications] Token unregistered successfully')
      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError.value = error.message
      console.error('[usePushNotifications] Failed to unregister token:', error)
      return false
    }
  }

  /**
   * Register a callback for foreground messages
   */
  const onMessage = (callback: ForegroundMessageCallback): (() => void) => {
    messageCallbacks.add(callback)
    return () => {
      messageCallbacks.delete(callback)
    }
  }

  // Cleanup on unmount
  if (import.meta.client) {
    onUnmounted(() => {
      messageCallbacks.clear()
    })
  }

  return {
    // State
    isSupported: readonly(isSupported),
    permissionState: readonly(permissionState),
    token: readonly(token),
    isInitializing: readonly(isInitializing),
    isRequestingPermission: readonly(isRequestingPermission),
    lastError: readonly(lastError),
    isRegistered: readonly(isRegistered),

    // Methods
    initialize,
    requestPermission,
    getToken,
    registerToken,
    unregisterToken,
    onMessage,
  }
}
