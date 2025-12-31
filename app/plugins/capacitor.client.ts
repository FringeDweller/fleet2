/**
 * Capacitor Initialization Plugin
 *
 * Initializes Capacitor plugins and sets up native app configuration:
 * - Status bar styling (dark/light content, background color)
 * - Splash screen auto-hide
 * - Keyboard configuration (scroll mode, resize mode)
 * - App lifecycle handling (foreground/background)
 * - Deep link handling
 */
import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize, KeyboardStyle } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export default defineNuxtPlugin(async () => {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const colorMode = useColorMode()
  const router = useRouter()

  // ============================================================
  // Status Bar Configuration
  // ============================================================

  const updateStatusBar = async () => {
    try {
      if (colorMode.value === 'dark') {
        // Dark mode: light content on dark background
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: '#1b1718' })
      } else {
        // Light mode: dark content on light background
        await StatusBar.setStyle({ style: Style.Light })
        await StatusBar.setBackgroundColor({ color: '#ffffff' })
      }
    } catch (error) {
      // StatusBar not available on all platforms (e.g., some Android devices)
      console.debug('[Capacitor] StatusBar configuration skipped:', error)
    }
  }

  // Set initial status bar style
  await updateStatusBar()

  // Watch for color mode changes and update status bar
  watch(
    () => colorMode.value,
    async () => {
      await updateStatusBar()
    },
  )

  // ============================================================
  // Keyboard Configuration (iOS only - Android uses manifest)
  // ============================================================

  if (Capacitor.isPluginAvailable('Keyboard')) {
    try {
      // Configure keyboard to resize the webview when opened
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body })

      // Set keyboard style based on color mode
      const updateKeyboardStyle = async () => {
        try {
          if (colorMode.value === 'dark') {
            await Keyboard.setStyle({ style: KeyboardStyle.Dark })
          } else {
            await Keyboard.setStyle({ style: KeyboardStyle.Light })
          }
        } catch (error) {
          console.debug('[Capacitor] Keyboard style configuration skipped:', error)
        }
      }

      await updateKeyboardStyle()

      // Update keyboard style when color mode changes
      watch(
        () => colorMode.value,
        async () => {
          await updateKeyboardStyle()
        },
      )

      // Enable scroll assist to ensure inputs are visible when keyboard opens
      await Keyboard.setScroll({ isDisabled: false })
    } catch (error) {
      console.debug('[Capacitor] Keyboard configuration skipped:', error)
    }
  }

  // ============================================================
  // App Lifecycle Handling
  // ============================================================

  if (Capacitor.isPluginAvailable('App')) {
    // Handle app state changes (foreground/background)
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App came to foreground
        console.debug('[Capacitor] App resumed (foreground)')
        // Could trigger data refresh, reconnect websockets, etc.
      } else {
        // App went to background
        console.debug('[Capacitor] App paused (background)')
        // Could save state, pause operations, etc.
      }
    })

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        // Navigate back in the Vue Router history
        router.back()
      } else {
        // At root of app, minimize instead of exit
        App.minimizeApp()
      }
    })

    // Handle deep links / app URL opens
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      console.debug('[Capacitor] Deep link received:', event.url)

      // Parse the URL and navigate to the appropriate route
      try {
        const url = new URL(event.url)
        const path = url.pathname

        // Navigate to the path if it's a valid route
        if (path && path !== '/') {
          router.push(path + url.search)
        }
      } catch (error) {
        console.error('[Capacitor] Failed to parse deep link:', error)
      }
    })
  }

  // ============================================================
  // Splash Screen Auto-Hide
  // ============================================================

  try {
    // Hide splash screen with fade animation after app is ready
    await SplashScreen.hide({
      fadeOutDuration: 500,
    })
  } catch (error) {
    console.debug('[Capacitor] SplashScreen hide skipped:', error)
  }
})
