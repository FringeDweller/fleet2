/**
 * Camera Composable for Capacitor Camera Access
 * Supports taking photos and selecting from gallery with graceful fallbacks
 */

import type { Photo } from '@capacitor/camera'
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera'

export type PhotoResultType = 'base64' | 'uri' | 'dataUrl'

export interface CameraPhoto {
  /** Base64 encoded image data (without data: prefix) */
  base64?: string
  /** File URI for native platforms */
  uri?: string
  /** Full data URL (data:image/jpeg;base64,...) */
  dataUrl?: string
  /** MIME type of the photo */
  mimeType: string
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** When the photo was taken */
  takenAt: string
  /** Source of the photo */
  source: 'camera' | 'gallery' | 'file-input'
}

export interface CameraOptions {
  /** Type of result to return */
  resultType?: PhotoResultType
  /** Image quality 0-100 */
  quality?: number
  /** Allow editing/cropping */
  allowEditing?: boolean
  /** Save to gallery on native */
  saveToGallery?: boolean
  /** Maximum width in pixels */
  width?: number
  /** Maximum height in pixels */
  height?: number
  /** Direction for front/back camera */
  direction?: 'front' | 'rear'
}

const DEFAULT_OPTIONS: CameraOptions = {
  resultType: 'base64',
  quality: 80,
  allowEditing: false,
  saveToGallery: false,
  width: 1920,
  height: 1920,
  direction: 'rear',
}

export function useCamera() {
  const { isNative, isPluginAvailable } = useCapacitor()
  const toast = useToast()

  // Track permission status
  const hasPermission = ref<boolean | null>(null)
  const permissionDenied = ref(false)
  const isLoading = ref(false)

  // File input ref for web fallback
  const fileInputRef = ref<HTMLInputElement | null>(null)
  let fileInputResolver: ((photo: CameraPhoto | null) => void) | null = null

  /**
   * Check if camera is available on this platform
   */
  const isCameraAvailable = computed(() => {
    if (!import.meta.client) return false
    if (isNative.value) {
      return isPluginAvailable('Camera')
    }
    // Check for Web API support
    return !!navigator.mediaDevices?.getUserMedia
  })

  /**
   * Check camera permissions
   */
  async function checkPermissions(): Promise<boolean> {
    if (!import.meta.client) return false

    if (isNative.value && isPluginAvailable('Camera')) {
      try {
        const result = await Camera.checkPermissions()
        hasPermission.value = result.camera === 'granted' || result.camera === 'limited'
        permissionDenied.value = result.camera === 'denied'
        return hasPermission.value
      } catch (error) {
        console.error('[useCamera] Permission check failed:', error)
        return false
      }
    }

    // Web platform - permission is granted on use
    hasPermission.value = true
    return true
  }

  /**
   * Request camera permissions
   */
  async function requestPermissions(): Promise<boolean> {
    if (!import.meta.client) return false

    if (isNative.value && isPluginAvailable('Camera')) {
      try {
        const result = await Camera.requestPermissions({
          permissions: ['camera', 'photos'],
        })
        hasPermission.value = result.camera === 'granted' || result.camera === 'limited'
        permissionDenied.value = result.camera === 'denied'

        if (permissionDenied.value) {
          toast.add({
            title: 'Camera Permission Denied',
            description: 'Please enable camera access in your device settings.',
            color: 'warning',
            icon: 'i-lucide-camera-off',
          })
        }

        return hasPermission.value
      } catch (error) {
        console.error('[useCamera] Permission request failed:', error)
        return false
      }
    }

    return true
  }

  /**
   * Take a photo using the device camera
   */
  async function takePhoto(options: CameraOptions = {}): Promise<CameraPhoto | null> {
    if (!import.meta.client) return null

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
    isLoading.value = true

    try {
      // Native platform - use Capacitor Camera
      if (isNative.value && isPluginAvailable('Camera')) {
        const granted = await requestPermissions()
        if (!granted) {
          return null
        }

        const photo = await Camera.getPhoto({
          resultType: mapResultType(mergedOptions.resultType!),
          source: CameraSource.Camera,
          quality: mergedOptions.quality,
          allowEditing: mergedOptions.allowEditing,
          saveToGallery: mergedOptions.saveToGallery,
          width: mergedOptions.width,
          height: mergedOptions.height,
          direction:
            mergedOptions.direction === 'front' ? CameraDirection.Front : CameraDirection.Rear,
        })

        return convertCapacitorPhoto(photo, 'camera', mergedOptions.resultType!)
      }

      // Web fallback - use file input with capture attribute
      return await captureFromFileInput('camera', mergedOptions)
    } catch (error: unknown) {
      handleCameraError(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Select a photo from the device gallery
   */
  async function selectFromGallery(options: CameraOptions = {}): Promise<CameraPhoto | null> {
    if (!import.meta.client) return null

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
    isLoading.value = true

    try {
      // Native platform - use Capacitor Camera
      if (isNative.value && isPluginAvailable('Camera')) {
        const granted = await requestPermissions()
        if (!granted) {
          return null
        }

        const photo = await Camera.getPhoto({
          resultType: mapResultType(mergedOptions.resultType!),
          source: CameraSource.Photos,
          quality: mergedOptions.quality,
          allowEditing: mergedOptions.allowEditing,
          width: mergedOptions.width,
          height: mergedOptions.height,
        })

        return convertCapacitorPhoto(photo, 'gallery', mergedOptions.resultType!)
      }

      // Web fallback - use file input
      return await captureFromFileInput('gallery', mergedOptions)
    } catch (error: unknown) {
      handleCameraError(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Pick a photo using either camera or gallery based on user choice
   */
  async function pickPhoto(options: CameraOptions = {}): Promise<CameraPhoto | null> {
    if (!import.meta.client) return null

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
    isLoading.value = true

    try {
      // Native platform - use Capacitor Camera with prompt
      if (isNative.value && isPluginAvailable('Camera')) {
        const granted = await requestPermissions()
        if (!granted) {
          return null
        }

        const photo = await Camera.getPhoto({
          resultType: mapResultType(mergedOptions.resultType!),
          source: CameraSource.Prompt,
          quality: mergedOptions.quality,
          allowEditing: mergedOptions.allowEditing,
          saveToGallery: mergedOptions.saveToGallery,
          width: mergedOptions.width,
          height: mergedOptions.height,
          promptLabelHeader: 'Photo',
          promptLabelPhoto: 'Take Photo',
          promptLabelPicture: 'Choose from Gallery',
          promptLabelCancel: 'Cancel',
        })

        const source = photo.saved ? 'camera' : 'gallery'
        return convertCapacitorPhoto(photo, source, mergedOptions.resultType!)
      }

      // Web fallback - use file input with both options
      return await captureFromFileInput('gallery', mergedOptions)
    } catch (error: unknown) {
      handleCameraError(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Web fallback: capture using file input
   */
  async function captureFromFileInput(
    mode: 'camera' | 'gallery',
    options: CameraOptions,
  ): Promise<CameraPhoto | null> {
    return new Promise((resolve) => {
      // Create file input if it does not exist
      if (!fileInputRef.value) {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.style.display = 'none'
        document.body.appendChild(input)
        fileInputRef.value = input

        input.addEventListener('change', async (event) => {
          const target = event.target as HTMLInputElement
          const file = target.files?.[0]

          if (file && fileInputResolver) {
            try {
              const photo = await processFileToPhoto(file, options.resultType!)
              fileInputResolver(photo)
            } catch {
              fileInputResolver(null)
            }
          } else if (fileInputResolver) {
            fileInputResolver(null)
          }

          // Reset for next use
          target.value = ''
          fileInputResolver = null
        })

        input.addEventListener('cancel', () => {
          if (fileInputResolver) {
            fileInputResolver(null)
            fileInputResolver = null
          }
        })
      }

      fileInputResolver = resolve

      // Set capture attribute for camera mode on mobile browsers
      if (mode === 'camera') {
        fileInputRef.value!.setAttribute('capture', 'environment')
      } else {
        fileInputRef.value!.removeAttribute('capture')
      }

      fileInputRef.value!.click()
    })
  }

  /**
   * Process a File object to a CameraPhoto
   */
  async function processFileToPhoto(file: File, resultType: PhotoResultType): Promise<CameraPhoto> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string

        // Get image dimensions
        const img = new Image()
        img.onload = () => {
          const photo: CameraPhoto = {
            mimeType: file.type || 'image/jpeg',
            takenAt: new Date().toISOString(),
            source: 'file-input',
            width: img.width,
            height: img.height,
          }

          if (resultType === 'dataUrl') {
            photo.dataUrl = dataUrl
          } else if (resultType === 'base64') {
            // Remove the data:image/xxx;base64, prefix
            photo.base64 = dataUrl.split(',')[1]
          } else {
            // URI - create object URL
            photo.uri = URL.createObjectURL(file)
          }

          resolve(photo)
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = dataUrl
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Convert Capacitor Photo to CameraPhoto
   */
  function convertCapacitorPhoto(
    photo: Photo,
    source: 'camera' | 'gallery',
    resultType: PhotoResultType,
  ): CameraPhoto {
    const result: CameraPhoto = {
      mimeType: `image/${photo.format || 'jpeg'}`,
      takenAt: new Date().toISOString(),
      source,
    }

    if (resultType === 'base64' && photo.base64String) {
      result.base64 = photo.base64String
    } else if (resultType === 'dataUrl' && photo.dataUrl) {
      result.dataUrl = photo.dataUrl
    } else if (photo.webPath) {
      result.uri = photo.webPath
    }

    return result
  }

  /**
   * Map our result type to Capacitor's CameraResultType
   */
  function mapResultType(resultType: PhotoResultType): CameraResultType {
    switch (resultType) {
      case 'base64':
        return CameraResultType.Base64
      case 'uri':
        return CameraResultType.Uri
      case 'dataUrl':
        return CameraResultType.DataUrl
      default:
        return CameraResultType.Base64
    }
  }

  /**
   * Handle camera errors
   */
  function handleCameraError(error: unknown): void {
    const err = error as { message?: string }
    const message = err.message || 'Unknown error'

    // User cancelled - not an error
    if (
      message.includes('cancelled') ||
      message.includes('canceled') ||
      message === 'User cancelled photos app'
    ) {
      return
    }

    console.error('[useCamera] Error:', error)

    if (message.includes('permission') || message.includes('denied')) {
      permissionDenied.value = true
      toast.add({
        title: 'Permission Required',
        description: 'Please allow camera access to take photos.',
        color: 'warning',
        icon: 'i-lucide-camera-off',
      })
    } else {
      toast.add({
        title: 'Camera Error',
        description: 'Failed to capture photo. Please try again.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }

  /**
   * Convert a base64 string to a Blob
   */
  function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  /**
   * Get a data URL from a CameraPhoto
   */
  function getDataUrl(photo: CameraPhoto): string {
    if (photo.dataUrl) return photo.dataUrl
    if (photo.base64) return `data:${photo.mimeType};base64,${photo.base64}`
    if (photo.uri) return photo.uri
    return ''
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (fileInputRef.value) {
      document.body.removeChild(fileInputRef.value)
      fileInputRef.value = null
    }
  })

  return {
    // State
    isCameraAvailable,
    hasPermission: readonly(hasPermission),
    permissionDenied: readonly(permissionDenied),
    isLoading: readonly(isLoading),

    // Methods
    checkPermissions,
    requestPermissions,
    takePhoto,
    selectFromGallery,
    pickPhoto,

    // Utilities
    base64ToBlob,
    getDataUrl,
  }
}
