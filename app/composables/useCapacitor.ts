import { Capacitor } from '@capacitor/core'

/**
 * Composable for Capacitor platform detection and utilities
 */
export function useCapacitor() {
  /**
   * Check if running as a native app
   */
  const isNative = computed(() => Capacitor.isNativePlatform())

  /**
   * Get the current platform
   */
  const platform = computed(() => Capacitor.getPlatform())

  /**
   * Check if running on Android
   */
  const isAndroid = computed(() => Capacitor.getPlatform() === 'android')

  /**
   * Check if running on iOS
   */
  const isIOS = computed(() => Capacitor.getPlatform() === 'ios')

  /**
   * Check if running in web browser
   */
  const isWeb = computed(() => Capacitor.getPlatform() === 'web')

  /**
   * Check if a plugin is available
   */
  const isPluginAvailable = (pluginName: string) => {
    return Capacitor.isPluginAvailable(pluginName)
  }

  return {
    isNative,
    platform,
    isAndroid,
    isIOS,
    isWeb,
    isPluginAvailable,
  }
}
