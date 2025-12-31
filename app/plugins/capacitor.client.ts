import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export default defineNuxtPlugin(async () => {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const colorMode = useColorMode()

  // Configure status bar based on color mode
  const updateStatusBar = async () => {
    try {
      if (colorMode.value === 'dark') {
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: '#1b1718' })
      } else {
        await StatusBar.setStyle({ style: Style.Light })
        await StatusBar.setBackgroundColor({ color: '#ffffff' })
      }
    } catch (error) {
      // StatusBar not available on all platforms
      console.debug('StatusBar configuration skipped:', error)
    }
  }

  // Set initial status bar style
  await updateStatusBar()

  // Watch for color mode changes
  watch(
    () => colorMode.value,
    async () => {
      await updateStatusBar()
    },
  )

  // Hide splash screen after app is ready
  try {
    await SplashScreen.hide({
      fadeOutDuration: 500,
    })
  } catch (error) {
    console.debug('SplashScreen hide skipped:', error)
  }
})
