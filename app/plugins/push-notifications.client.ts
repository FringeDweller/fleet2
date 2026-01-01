/**
 * Push Notifications Client Plugin
 *
 * Initializes Firebase Cloud Messaging (FCM) for push notifications:
 * - Checks browser support for push notifications
 * - Requests notification permission from the user (if previously granted)
 * - Gets FCM token and registers it with the backend
 * - Handles token refresh
 * - Listens for foreground messages and displays them using toast notifications
 *
 * This plugin only runs on the client-side (.client.ts suffix).
 *
 * Environment variables (from runtime config):
 * - NUXT_PUBLIC_FIREBASE_API_KEY
 * - NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NUXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NUXT_PUBLIC_FIREBASE_APP_ID
 * - NUXT_PUBLIC_FIREBASE_VAPID_KEY (for web push)
 */

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig()

  // Check if Firebase config is available
  const hasFirebaseConfig =
    runtimeConfig.public.firebaseApiKey && runtimeConfig.public.firebaseProjectId

  if (!hasFirebaseConfig) {
    console.debug(
      '[PushNotifications] Firebase not configured. Set NUXT_PUBLIC_FIREBASE_* environment variables.',
    )
    return
  }

  // Check for service worker support
  if (!('serviceWorker' in navigator)) {
    console.debug('[PushNotifications] Service workers not supported')
    return
  }

  // Check for Notification API support
  if (!('Notification' in window)) {
    console.debug('[PushNotifications] Notifications not supported')
    return
  }

  // Check for PushManager support
  if (!('PushManager' in window)) {
    console.debug('[PushNotifications] Push API not supported')
    return
  }

  // Initialize the push notifications composable
  const pushNotifications = usePushNotifications({
    autoRequestPermission: false, // Don't auto-request, let UI handle it
    autoRegisterToken: true, // Auto-register when permission is granted
    onForegroundMessage: (payload) => {
      console.debug('[PushNotifications] Foreground message:', payload)
      // Toast notification is handled by the composable
    },
  })

  // Initialize (will check permission and get token if already granted)
  try {
    await pushNotifications.initialize()

    // Register the service worker for FCM if not already done
    await registerFirebaseServiceWorker()
  } catch (err) {
    console.error('[PushNotifications] Initialization failed:', err)
    // Don't throw - plugin should fail gracefully
  }

  // Watch for user session changes
  // When user logs in/out, we may need to register/unregister token
  const { loggedIn } = useUserSession()

  watch(
    loggedIn,
    async (isLoggedIn, wasLoggedIn) => {
      if (isLoggedIn && !wasLoggedIn) {
        // User just logged in - register token if we have permission
        if (pushNotifications.permissionState.value === 'granted') {
          const token = await pushNotifications.getToken()
          if (token) {
            await pushNotifications.registerToken(token)
          }
        }
      } else if (!isLoggedIn && wasLoggedIn) {
        // User logged out - unregister token
        await pushNotifications.unregisterToken()
      }
    },
    { immediate: false },
  )
})

/**
 * Register Firebase Messaging service worker
 */
async function registerFirebaseServiceWorker(): Promise<void> {
  // Check if service worker is already registered
  const registrations = await navigator.serviceWorker.getRegistrations()
  const hasFCMWorker = registrations.some((reg) =>
    reg.active?.scriptURL.includes('firebase-messaging-sw'),
  )

  if (hasFCMWorker) {
    console.debug('[PushNotifications] Firebase service worker already registered')
    return
  }

  try {
    // Check if there's a firebase-messaging-sw.js file available
    // If not, FCM will use the default service worker
    const response = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' })
    if (response.ok) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      console.debug('[PushNotifications] Firebase service worker registered')
    }
  } catch (err) {
    // Service worker file doesn't exist, FCM will handle it
    console.debug('[PushNotifications] No custom service worker, using FCM default')
  }
}
