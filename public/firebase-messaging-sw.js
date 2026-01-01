/**
 * Firebase Messaging Service Worker
 *
 * Handles background push notifications when the app is not in the foreground.
 * This service worker is registered by the push-notifications.client.ts plugin.
 *
 * Note: Firebase configuration must be duplicated here since service workers
 * don't have access to the main app's runtime config.
 *
 * Environment variables should be replaced at build time or use a config endpoint.
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase configuration
// These values should be set via environment variables at build time
// or fetched from a config endpoint
const firebaseConfig = {
  apiKey: self.__FIREBASE_API_KEY__ || '',
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || '',
  projectId: self.__FIREBASE_PROJECT_ID__ || '',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || '',
  appId: self.__FIREBASE_APP_ID__ || '',
}

// Only initialize if we have a valid config
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig)

  // Get messaging instance
  const messaging = firebase.messaging()

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw] Background message received:', payload)

    // Customize notification
    const notificationTitle = payload.notification?.title || 'New Notification'
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.messageId || 'default',
      data: payload.data || {},
      // Vibration pattern for mobile devices
      vibrate: [200, 100, 200],
      // Show notification actions if data specifies them
      actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [],
    }

    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions)
  })
} else {
  console.log('[firebase-messaging-sw] Firebase not configured, skipping initialization')
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification clicked:', event)

  event.notification.close()

  // Get the action clicked (if any)
  const action = event.action
  const data = event.notification.data

  // Determine the URL to open
  let urlToOpen = '/'

  if (action && data?.actionUrls?.[action]) {
    urlToOpen = data.actionUrls[action]
  } else if (data?.url) {
    urlToOpen = data.url
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Try to find an existing window and focus it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((focusedClient) => {
              // Navigate to the URL if different
              if (focusedClient && urlToOpen !== '/') {
                return focusedClient.navigate(urlToOpen)
              }
            })
          }
        }

        // Open a new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      }),
  )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw] Notification closed:', event)

  // Could track notification dismissals here
  const data = event.notification.data
  if (data?.trackDismissal) {
    // Send analytics or update server
    fetch('/api/notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dismissed',
        notificationId: data.notificationId,
      }),
    }).catch(() => {
      // Ignore errors for analytics
    })
  }
})
