/**
 * NFC Composable for Web NFC API (Android Chrome only)
 * Provides NFC reading and writing capabilities
 */

interface NDEFMessage {
  records: NDEFRecord[]
}

interface NDEFRecord {
  recordType: string
  mediaType?: string
  id?: string
  data?: BufferSource
  encoding?: string
  lang?: string
}

interface NDEFReader {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>
  write: (
    message: string | NDEFMessage,
    options?: { overwrite?: boolean; signal?: AbortSignal },
  ) => Promise<void>
  addEventListener: (type: 'reading' | 'readingerror', listener: (event: any) => void) => void
  removeEventListener: (type: 'reading' | 'readingerror', listener: (event: any) => void) => void
}

declare global {
  interface Window {
    NDEFReader?: {
      new (): NDEFReader
    }
  }
}

export function useNfc() {
  const isNfcSupported = ref(false)
  const isNfcAvailable = computed(() => {
    // Web NFC API is only available in Android Chrome
    // iOS does not support Web NFC (Core NFC is read-only via native apps)
    return import.meta.client && 'NDEFReader' in window
  })

  // Check NFC support on mount
  if (import.meta.client) {
    isNfcSupported.value = isNfcAvailable.value
  }

  /**
   * Write asset UUID to NFC tag (Android only)
   */
  async function writeAssetTag(
    assetId: string,
  ): Promise<{ success: boolean; tagId?: string; error?: string }> {
    if (!isNfcAvailable.value) {
      return {
        success: false,
        error: 'NFC is not supported on this device. Please use an Android device with NFC.',
      }
    }

    try {
      const ndef = new window.NDEFReader!()

      // Write asset URL to tag - the API accepts a string directly for simple messages
      await ndef.write(`fleet://asset/${assetId}`, { overwrite: true })

      return {
        success: true,
        tagId: assetId,
      }
    } catch (error: any) {
      console.error('NFC write error:', error)

      let errorMessage = 'Failed to write NFC tag'
      if (error.name === 'NotAllowedError') {
        errorMessage = 'NFC access denied. Please enable NFC in your device settings.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC is not supported on this device.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Could not read NFC tag. Please try again.'
      } else if (error.name === 'AbortError') {
        errorMessage = 'NFC write operation was cancelled.'
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Read asset UUID from NFC tag
   */
  async function readAssetTag(
    timeout = 10000,
  ): Promise<{ success: boolean; assetId?: string; error?: string }> {
    if (!isNfcAvailable.value) {
      return {
        success: false,
        error: 'NFC is not supported on this device.',
      }
    }

    return new Promise((resolve) => {
      const ndef = new window.NDEFReader!()
      const abortController = new AbortController()

      // Set timeout
      const timeoutId = setTimeout(() => {
        abortController.abort()
        resolve({
          success: false,
          error: 'NFC scan timed out. Please try again.',
        })
      }, timeout)

      ndef.addEventListener('reading', ({ message }: any) => {
        clearTimeout(timeoutId)
        abortController.abort()

        try {
          const record = message.records[0]
          const textDecoder = new TextDecoder(record.encoding || 'utf-8')
          const url = textDecoder.decode(record.data)

          // Extract asset ID from URL: fleet://asset/{id}
          const match = url.match(/fleet:\/\/asset\/([a-f0-9-]+)/)
          if (match) {
            resolve({
              success: true,
              assetId: match[1],
            })
          } else {
            resolve({
              success: false,
              error: 'Invalid NFC tag format.',
            })
          }
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to read NFC tag data.',
          })
        }
      })

      ndef.addEventListener('readingerror', () => {
        clearTimeout(timeoutId)
        abortController.abort()
        resolve({
          success: false,
          error: 'Error reading NFC tag.',
        })
      })

      ndef.scan({ signal: abortController.signal }).catch((error: any) => {
        clearTimeout(timeoutId)
        let errorMessage = 'Failed to scan NFC tag'
        if (error.name === 'NotAllowedError') {
          errorMessage = 'NFC access denied. Please enable NFC in your device settings.'
        }
        resolve({
          success: false,
          error: errorMessage,
        })
      })
    })
  }

  /**
   * Check if device has NFC hardware enabled
   */
  async function checkNfcEnabled(): Promise<boolean> {
    if (!isNfcAvailable.value) {
      return false
    }

    try {
      const ndef = new window.NDEFReader!()
      const abortController = new AbortController()

      // Try to start scanning (will fail if NFC is disabled)
      await ndef.scan({ signal: abortController.signal })
      abortController.abort()
      return true
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        return false
      }
      return false
    }
  }

  return {
    isNfcSupported: computed(() => isNfcSupported.value),
    isNfcAvailable,
    writeAssetTag,
    readAssetTag,
    checkNfcEnabled,
  }
}
